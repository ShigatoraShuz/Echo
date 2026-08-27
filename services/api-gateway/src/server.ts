import { listen } from "@echo/service-core";
import { createGatewayApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
listen(createGatewayApp(config), { name: "api-gateway", port: config.PORT });
