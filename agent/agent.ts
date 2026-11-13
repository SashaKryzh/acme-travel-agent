import {defineAgent} from "eve";
import {defineDynamic} from "eve/models";

import {modelSelection} from "./lib/model";

export default defineAgent({
    // Read from the environment at run time, so switching providers needs no code change.
    model: defineDynamic(() => modelSelection()),
    // Shell, files, web fetch, eve's own web search and the root-copy `agent` tool are off: the travel tools are the whole surface.
    defaultTools: false
});
