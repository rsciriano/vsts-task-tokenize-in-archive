"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const jszip_1 = __importDefault(require("jszip"));
const fs_1 = __importDefault(require("fs"));
const path = require("path");
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let pathToArchives = tl.getPathInput('PathToArchives', true);
            let packages = tl.getPathInput('Packages', true);
            let filesToTokenize = tl.getPathInput('FilesToTokenize', false);
            let prefix = tl.getInput('Prefix', false);
            let suffix = tl.getInput('Suffix', false);
            let replaceWithEmpty = tl.getBoolInput('ReplaceWithEmpty', false);
            prefix = prefix ? prefix : '__';
            suffix = suffix ? suffix : '__';
            let tokenPrefix = escapeRegExp(prefix);
            let tokenSuffix = escapeRegExp(suffix);
            let tokenRegex = tokenPrefix + '((?:(?!' + tokenSuffix + ').)*)' + tokenSuffix;
            let secretTokens = {};
            console.log('PathToArchives = ', pathToArchives);
            console.log('Packages = ', packages);
            console.log('FilesToTokenize = ', filesToTokenize);
            console.log('Prefix = ', prefix);
            console.log('Suffix = ', suffix);
            console.log('ReplaceWithEmpty = ', replaceWithEmpty);
            console.log('TokenRegex = ', tokenRegex);
            // normalize the source folder path. this is important for later in order to accurately
            // determine the relative path of each found file (substring using pathToArchives.length).
            pathToArchives = path.normalize(pathToArchives);
            // search package files
            let allPaths = tl.find(pathToArchives); // default find options (follow sym links)
            let matchedPaths = tl.match(allPaths, packages, pathToArchives); // default match options
            let matchedFiles = matchedPaths.filter((itemPath) => !tl.stats(itemPath).isDirectory()); // filter-out directories        
            if (matchedFiles.length > 0) {
                matchedFiles.forEach((file) => {
                    // read each zip file
                    fs_1.default.readFile(file, (err, data) => {
                        if (err)
                            throw err;
                        jszip_1.default.loadAsync(data).then(zip => {
                            let zipedAllPaths = Object.keys(zip.files);
                            let zipedMatchedPaths = tl.match(zipedAllPaths, filesToTokenize);
                            let zipedMatchedFiles = zipedMatchedPaths.filter((itemPath) => !zip.files[itemPath].dir); // filter-out directories        
                            if (zipedMatchedFiles.length > 0) {
                                let tasks = [];
                                zipedMatchedFiles.forEach((contentPath) => {
                                    console.log('FileToTokenize:', contentPath);
                                    // ...
                                    let zipObject = zip.files[contentPath];
                                    let t = zipObject.async("text");
                                    t.then(contents => {
                                        console.log('Contents:', contents);
                                        let reg = new RegExp(tokenRegex, "g");
                                        // loop through each match
                                        let match;
                                        // keep a separate var for the contents so that the regex index doesn't get messed up
                                        // by replacing items underneath it
                                        var newContents = contents;
                                        while ((match = reg.exec(contents)) !== null) {
                                            var vName = match[1];
                                            if (typeof secretTokens[vName.toLowerCase()] !== 'undefined') {
                                                // try find the variable in secret tokens input first
                                                newContents = newContents.replace(match[0], secretTokens[vName.toLowerCase()]);
                                                console.info(`Replaced token [${vName}] with a secret value`);
                                            }
                                            else {
                                                // find the variable value in the environment
                                                var vValue = tl.getVariable(vName);
                                                if (typeof vValue === 'undefined') {
                                                    tl.warning(`Token [${vName}] does not have an environment value`);
                                                }
                                                else {
                                                    newContents = newContents.replace(match[0], vValue);
                                                    console.info(`Replaced token [${vName}]`);
                                                }
                                            }
                                        }
                                        zip.file(contentPath, newContents);
                                    });
                                    tasks.push(t);
                                });
                                // Wait for tokenize package contents
                                Promise.all(tasks).then(() => {
                                    // 
                                    zip
                                        .generateNodeStream({ type: 'nodebuffer', streamFiles: true })
                                        .pipe(fs_1.default.createWriteStream(file))
                                        .on('finish', function () {
                                        console.log(file, " written.");
                                        tl.setResult(tl.TaskResult.Succeeded, file + " written", false);
                                    });
                                });
                            }
                        }).catch(err => {
                            tl.setResult(tl.TaskResult.Failed, err);
                        });
                    });
                });
            }
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        }
    });
}
run();
