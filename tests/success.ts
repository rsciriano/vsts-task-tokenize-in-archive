import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '../src/TokenizeInArchiveTask', 'TokenizeInArchive.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);

runner.setInput('PathToArchives', '/srcDir');
runner.setInput('Packages', 'AppSettings.zip');
runner.setInput('FilesToTokenize', '**/AppSettings.json');

let answers: mockanswer.TaskLibAnswers =  {
    checkPath:  { },
    find: { },
    findMatch: { }    
};

answers.checkPath[path.normalize('/srcDir')] = true;

answers.find[path.normalize('/srcDir')] = [
    path.normalize('/srcDir'),
    path.normalize('/srcDir/AppSettings.zip'),
    path.normalize('/srcDir/someOtherDir'),
    path.normalize('/srcDir/someOtherDir/file1.file'),
    path.normalize('/srcDir/someOtherDir/file2.file'),
    path.normalize('/srcDir/someOtherDir2'),
    path.normalize('/srcDir/someOtherDir2/file1.file'),
    path.normalize('/srcDir/someOtherDir2/file2.file'),
    path.normalize('/srcDir/someOtherDir2/file3.file'),
    path.normalize('/srcDir/someOtherDir3'),
];

runner.setAnswers(answers);

runner.registerMockExport('stats', (itemPath: string) => {
    console.log('##vso[task.debug]stats ' + itemPath);
    switch (itemPath) {
        case path.normalize('/srcDir/someOtherDir'):
        case path.normalize('/srcDir/someOtherDir2'):
        case path.normalize('/srcDir/someOtherDir3'):
            return { isDirectory: () => true };
        case path.normalize('/srcDir/AppSettings.zip'):
        case path.normalize('/srcDir/someOtherDir/file1.file'):
        case path.normalize('/srcDir/someOtherDir/file2.file'):
        case path.normalize('/srcDir/someOtherDir2/file1.file'):
        case path.normalize('/srcDir/someOtherDir2/file2.file'):
        case path.normalize('/srcDir/someOtherDir2/file3.file'):
            return { isDirectory: () => false };
        default:
            throw { code: 'ENOENT' };
    }
});

let _readFile = fs.readFile;
let _createWriteStream = fs.createWriteStream;

(<any>fs).readFile = function (filename: any, cb: any) {
    if (filename == path.normalize('/srcDir/AppSettings.zip')){
        //cb(null, new Buffer("fake contents"));
        _readFile(path.join(__dirname, 'samples/AppSettings.zip'), cb);
    }
    else {
        _readFile(filename, cb);
    }
    
  };


  (<any>fs).createWriteStream = function (filename: any) {
    if (filename == path.normalize('/srcDir/AppSettings.zip')){
        //cb(null, new Buffer("fake contents"));
        return _createWriteStream(path.join(__dirname, 'samples/AppSettings_updated.zip'));
    }
    else {
        return _createWriteStream(filename);
    }
    
  };


runner.registerMock('fs', fs);


// set variables
process.env["PROPERTY1"] = "Property1_Value";
process.env["PROPERTY2"] = "Property2_Value";
process.env["PROPERTY3"] = "Property3_Value";

runner.run();