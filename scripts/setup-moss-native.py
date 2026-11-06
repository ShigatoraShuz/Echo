"""Explicit pinned MOSS v1.5 native setup; isolated from existing Python environments."""
import argparse,hashlib,json,os,shutil,sys,time,urllib.request,zipfile,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FORK='b785003ba497794ecfa337c3e47f01af79489888'
ARCHIVE_SHA='42a5df3085b36f3f9845538b314f213b1d5aace591d05e89ff589ed27a27dea4'
MODEL_REV='cdd3b911b1585e3f2dbc7775ef10f9926f58850a'
CODEC_REV='3cd226ba2947efa357ef453bcad111b6eafba782'

def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  while chunk:=stream.read(8*1024**2):h.update(chunk)
 return h.hexdigest()

def fetch(url,path,sha=None):
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.is_file() and (sha is None or digest(path)==sha):return
 if '.safetensors' in url:
  os.environ['HF_HUB_OFFLINE']='0'
  os.environ['HF_XET_HIGH_PERFORMANCE']='1'
  os.environ['HF_XET_CHUNK_CACHE_SIZE_BYTES']='0'
  from huggingface_hub import hf_hub_download
  repository,asset=url.removeprefix('https://huggingface.co/').split('/resolve/',1)
  revision,name=asset.split('/',1)
  hf_hub_download(repository,name,revision=revision,local_dir=path.parent,token=False)
  if sha and digest(path)!=sha:raise ValueError('Native asset integrity mismatch')
  os.environ['HF_HUB_OFFLINE']='1'
  return
 temporary=path.with_suffix(path.suffix+'.partial')
 offset=temporary.stat().st_size if temporary.exists() else 0
 request=urllib.request.Request(url,headers={'Range':f'bytes={offset}-'} if offset else {})
 with urllib.request.urlopen(request,timeout=90) as response,temporary.open('ab' if offset and response.status==206 else 'wb') as out:
  while chunk:=response.read(1024**2):out.write(chunk)
 if sha and digest(temporary)!=sha:raise ValueError('Native asset integrity mismatch')
 os.replace(temporary,path)

def download(repo,revision,folder):
 api=json.load(urllib.request.urlopen(f'https://huggingface.co/api/models/{repo}/revision/{revision}?blobs=true',timeout=30))
 if api['sha']!=revision:raise ValueError('Revision differs')
 records=[]
 for entry in api['siblings']:
  name=entry['rfilename']
  if not (name.endswith(('.json','.safetensors','.model','.txt','.md')) or name in ('LICENSE','NOTICE')):continue
  path=(folder/name).resolve()
  if not path.is_relative_to(folder.resolve()):raise ValueError('Invalid asset path')
  expected=entry.get('lfs',{}).get('sha256')
  print(json.dumps({'stage':'asset','file':name,'repository':repo}),flush=True)
  fetch(f'https://huggingface.co/{repo}/resolve/{revision}/{name}',path,expected)
  if entry.get('size') is not None and path.stat().st_size!=entry['size']:raise ValueError('Asset size differs')
  records.append({'path':name,'bytes':path.stat().st_size,'sha256':digest(path)})
 return records

def patch(source):
 context=source/'src/llama-context.cpp'
 text=context.read_text(encoding='utf-8')
 original='    if (output_ids.size() < (size_t) n_outputs_max) {\n        output_ids.resize(n_outputs_max);\n    }'
 replacement='    // ECHO_INPUT_INDEX_BOUNDS: decode output IDs index the original input batch.\n    const auto output_ids_required = std::max<int64_t>(n_outputs_max, cparams.n_batch);\n    if (output_ids.size() < (size_t) output_ids_required) {\n        output_ids.resize(output_ids_required);\n    }'
 if 'ECHO_INPUT_INDEX_BOUNDS' not in text:
  if original not in text:raise ValueError('Pinned output-index allocator differs')
  text=text.replace(original,replacement,1).replace('            output_ids[out_id] = i;','            GGML_ASSERT(out_id >= 0 && (size_t) out_id < output_ids.size());\n            output_ids[out_id] = i;',1)
  context.write_text(text,encoding='utf-8')
 p=source/'tools/tts/run-moss-tts-delay.cpp';s=p.read_text(encoding='utf-8')
 if 'ECHO_MEMORY_IO' in s:
  if 'ECHO_REQUIRE_COMPLETE' not in s:
   s=s.replace('        generated_frames = generated_packed.size() / cfg.packed_stride();',
    '        if (!state.is_stopping) throw std::runtime_error("ECHO_REQUIRE_COMPLETE");\n        generated_frames = generated_packed.size() / cfg.packed_stride();',1)
   p.write_text(s,encoding='utf-8')
  return
 s=s.replace('#include <fstream>','#include <fstream>\n#include <iostream>\n#ifdef _WIN32\n#include <io.h>\n#include <fcntl.h>\n#endif\n// ECHO_MEMORY_IO: prompts via stdin, WAV via stdout; no inference files.')
 s=s.replace('    std::ofstream file(fname, std::ios::binary);','    std::ofstream owned;\n    if (fname != "-") owned.open(fname, std::ios::binary);\n    std::ostream & file = fname == "-" ? std::cout : owned;',1)
 original='''                std::ifstream in(text_file_path);
                if (!in) {
                    throw std::runtime_error("failed to open text file: " + text_file_path);
                }
                std::ostringstream ss;
                ss << in.rdbuf();
                input_text = ss.str();'''
 replacement='''                std::ifstream owned;
                if (text_file_path != "-") owned.open(text_file_path);
                std::istream & in = text_file_path == "-" ? std::cin : owned;
                if (!in) throw std::runtime_error("text input unavailable");
                input_text.clear();
                char ch;
                while (in.get(ch)) {
                    if (input_text.size() >= 20000) throw std::runtime_error("text input too large");
                    input_text.push_back(ch);
                }'''
 if original not in s:raise ValueError('Pinned text reader differs')
 s=s.replace(original,replacement,1).replace('int main(int argc, char ** argv) {','int main(int argc, char ** argv) {\n#ifdef _WIN32\n    _setmode(_fileno(stdout), _O_BINARY);\n    _setmode(_fileno(stdin), _O_BINARY);\n#endif',1)
 s=s.replace('        generated_frames = generated_packed.size() / cfg.packed_stride();','        if (!state.is_stopping) throw std::runtime_error("ECHO_REQUIRE_COMPLETE");\n        generated_frames = generated_packed.size() / cfg.packed_stride();',1)
 p.write_text(s,encoding='utf-8')
 p=source/'common/log.cpp';s=p.read_text(encoding='utf-8');s=s.replace('fcur = stdout;','fcur = stderr;');p.write_text(s,encoding='utf-8')

def run(args):
 subprocess.run([str(v) for v in args],check=True,timeout=3600,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--setup',action='store_true');parser.add_argument('--limited',action='store_true');args=parser.parse_args()
 if not args.setup:parser.error('Downloads/build/conversion require --setup')
 sys.path.insert(0,str(ROOT/'scripts'));from windows_resource_limits import run_limited,assert_current_limits
 if not args.limited:return run_limited([sys.executable,str(Path(__file__).resolve()),'--setup','--limited'])
 assert_current_limits();os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',PYTHONDONTWRITEBYTECODE='1')
 root=ROOT/'models/moss-native';root.mkdir(exist_ok=True)
 if shutil.disk_usage(root).free<60*1024**3:raise ValueError('At least 60 GiB staging space required')
 archive=root/(FORK+'.zip');fetch('https://codeload.github.com/OpenMOSS/llama.cpp/zip/'+FORK,archive,ARCHIVE_SHA)
 source=root/'source'
 if not source.exists():
  with zipfile.ZipFile(archive) as z:
   for entry in z.infolist():
    if not (root/entry.filename).resolve().is_relative_to(root.resolve()):raise ValueError('Unsafe archive')
   z.extractall(root)
  (root/('llama.cpp-'+FORK)).rename(source)
 patch(source)
 cmake=Path('C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe')
 build=root/'build'
 run([cmake,'-S',source,'-B',build,'-G','Visual Studio 17 2022','-A','x64','-DGGML_CUDA=ON','-DCMAKE_CUDA_ARCHITECTURES=120','-DLLAMA_CURL=OFF','-DLLAMA_BUILD_TESTS=OFF','-DLLAMA_BUILD_EXAMPLES=OFF'])
 run([cmake,'--build',build,'--config','Release','--target','llama-moss-tts','llama-quantize','--parallel','4'])
 model=root/'hf-v15';model_files=download('OpenMOSS-Team/MOSS-TTS-v1.5',MODEL_REV,model)
 config=json.loads((model/'config.json').read_text(encoding='utf-8'))
 if config.get('architectures',[None])[0] not in ('MossTTSDelayModel','MossTTSDelayForCausalLM'):raise ValueError('Expected exact MOSS v1.5 Delay architecture')
 codec_revision=CODEC_REV
 codec=root/'hf-codec';codec_files=download('OpenMOSS-Team/MOSS-Audio-Tokenizer',codec_revision,codec)
 output=root/'artifacts';output.mkdir(exist_ok=True)
 backbone=output/'moss-v15-f16.gguf'
 if not backbone.exists():run([sys.executable,source/'convert_hf_to_gguf.py',model,'--outfile',backbone,'--outtype','f16'])
 quantized=output/'moss-v15-q4_k_m.gguf'
 if not quantized.exists():run([build/'bin/Release/llama-quantize.exe',backbone,quantized,'Q4_K_M','8'])
 if not (output/'moss_tts_audio_decoder_f16.gguf').exists():run([sys.executable,source/'convert_moss_audio_tokenizer_split_to_gguf.py',codec,'--encoder-outfile',output/'moss_tts_audio_encoder_f16.gguf','--decoder-outfile',output/'moss_tts_audio_decoder_f16.gguf','--outtype','f16'])
 files=[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)} for directory in (output,build/'bin/Release') for p in directory.iterdir() if p.is_file()]
 manifest={'schemaVersion':1,'forkRevision':FORK,'sourceArchiveSHA256':ARCHIVE_SHA,'modelRevision':MODEL_REV,'codecRevision':codec_revision,'modelFiles':model_files,'codecFiles':codec_files,'files':files,'patches':{p.relative_to(source).as_posix():digest(p) for p in [source/'tools/tts/run-moss-tts-delay.cpp',source/'common/log.cpp',source/'src/llama-context.cpp']},'validated':False}
 target=root/'manifest.json';temp=target.with_suffix('.tmp');temp.write_text(json.dumps(manifest,indent=2),encoding='utf-8');os.replace(temp,target)
 print(json.dumps({'stage':'artifacts_ready','validated':False}),flush=True)
 return 0

if __name__=='__main__':raise SystemExit(main())
