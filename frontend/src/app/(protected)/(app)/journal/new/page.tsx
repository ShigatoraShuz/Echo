import {JournalEditorView} from '@/features/journal/view/journal-editor-view';
export default async function NewJournalEntryPage({searchParams}:{searchParams:Promise<{fresh?:string}>}){
 const query=await searchParams;return <JournalEditorView key={'new-'+(query.fresh??'initial')}/>;
}
