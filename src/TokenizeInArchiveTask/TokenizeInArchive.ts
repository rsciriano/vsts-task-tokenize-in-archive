import tl = require('azure-pipelines-task-lib/task');

import JSZip from "jszip";
import fs from "fs"
import path = require('path');

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

async function run() {
    try {
        let pathToArchives = tl.getPathInput('PathToArchives', true);
        let packages = tl.getPathInput('Packages', true);
        let filesToTokenize = tl.getPathInput('FilesToTokenize', false);
        let prefix = tl.getInput('Prefix', false);
        let suffix = tl.getInput('Suffix', false);
        let replaceWithEmpty = tl.getBoolInput('ReplaceWithEmpty', false);


        prefix = prefix ? prefix : '__';
        suffix = suffix ? suffix : '__';

        let tokenPrefix = escapeRegExp(prefix)
        let tokenSuffix = escapeRegExp(suffix)
        let tokenRegex = tokenPrefix + '((?:(?!' + tokenSuffix + ').)*)' + tokenSuffix;
        
        let secretTokens: {[id: string]: string} = {};

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
        let allPaths: string[] = tl.find(pathToArchives); // default find options (follow sym links)
        let matchedPaths: string[] = tl.match(allPaths, packages, pathToArchives); // default match options
        let matchedFiles: string[] = matchedPaths.filter((itemPath: string) => !tl.stats(itemPath).isDirectory()); // filter-out directories        

        if (matchedFiles.length > 0) {

            matchedFiles.forEach((packageFile: string) => {

                // read each zip file
                fs.readFile(packageFile, (err, data) => {
                    if (err) throw err;
                    
                    console.log('Package file found: ', packageFile);

                    JSZip.loadAsync(data).then(zip => {

                        let zipedAllPaths: string[] = Object.keys(zip.files);
                        let zipedMatchedPaths: string[] = tl.match(zipedAllPaths, filesToTokenize);
                        let zipedMatchedFiles: string[] = zipedMatchedPaths.filter((itemPath: string) => !zip.files[itemPath].dir); // filter-out directories        

                        if (zipedMatchedFiles.length > 0) {

                            let tasks: Promise<string>[] = [];
                            
                            zipedMatchedFiles.forEach((contentPath: string) => {

                                console.log(`Tokenizing file '${contentPath}' in '${packageFile}'`);
    
                                let zipObject = zip.files[contentPath];
                                let t = zipObject.async("text");
                                t.then(contents => {
                                    
                                    tl.debug(`File contents: ${contents}`);    

                                    let reg = new RegExp(tokenRegex, "g");
                    
                                    // loop through each match
                                    let match: RegExpExecArray | null;
                                    // keep a separate var for the contents so that the regex index doesn't get messed up
                                    // by replacing items underneath it
                                    var newContents = contents;
                                    while((match = reg.exec(contents)) !== null) {
                                        var vName = match[1];
                                        if (typeof secretTokens[vName.toLowerCase()] !== 'undefined') {
                                            // try find the variable in secret tokens input first
                                            newContents = newContents.replace(match[0], secretTokens[vName.toLowerCase()]);
                                            console.info(`Replaced token [${vName}] with a secret value`);
                                        } else {
                                            // find the variable value in the environment
                                            var vValue = tl.getVariable(vName);
                                            if (typeof vValue === 'undefined') {
                                                tl.warning(`Token [${vName}] does not have an environment value`);
                                            } else {
                                                newContents = newContents.replace(match[0], vValue);
                                                console.info(`Replaced token [${vName }]`);
                                            }           
                                        }
                                    }

                                    zip.file(contentPath, newContents);
    
                                });

                                tasks.push(t);
                            });
                            
                            // Wait for tokenize package contents
                            Promise.all(tasks).then(() => {

                                zip
                                .generateNodeStream({type:'nodebuffer',streamFiles:true})
                                .pipe(fs.createWriteStream(packageFile))
                                .on('finish', function () {
                                    console.log(`${packageFile} updated`);
                                    tl.setResult(tl.TaskResult.Succeeded, `${packageFile} updated`, false);
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
}

run();