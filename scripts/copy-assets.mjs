import { mkdir, copyFile } from "node:fs/promises";

const destination = new URL("../dist/src/docs/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(new URL("../src/docs/greencode-swagger.css", import.meta.url), new URL("greencode-swagger.css", destination));
