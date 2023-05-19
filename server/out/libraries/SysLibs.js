"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSysLibsFromGH = void 0;
const Compiler_1 = require("../compiler/Compiler");
const events_1 = require("../events");
const XetoLib_1 = require("./XetoLib");
const utils_1 = require("./utils");
const librariesToAdd = [{
        name: 'sys',
        files: ['meta.xeto', 'types.xeto'],
    }, {
        name: 'ph',
        files: ['kinds.xeto', 'entities.xeto'],
    }, {
        name: 'ph.equips',
        files: ['equips.xeto'],
    }, {
        name: 'ph.points',
        files: ['air-flow.xeto', 'air-humidity.xeto', 'air-pressure.xeto', 'air-temp.xeto', 'base.xeto', 'co2.xeto', 'damper.xeto', 'fan.xeto', 'misc.xeto', 'motor.xeto', 'occupied.xeto', 'valve.xeto'],
    }, {
        name: 'ashrae.g36',
        files: ['vavs.xeto'],
    },
];
const processSysLibNo = async (baseURL, lm, index) => {
    if (index >= librariesToAdd.length) {
        events_1.eventBus.fire(0 /* SYS_LIBS_LOADED */);
        return;
    }
    const libInfo = librariesToAdd[index];
    //	reading lib.xeto to get meta data about the library
    const libInfoUri = `${baseURL}/${libInfo.name}/lib.xeto`;
    const libXeto = await utils_1.readUrl(libInfoUri);
    const libInfoCompiler = new Compiler_1.ProtoCompiler(libInfoUri.replace('https://', 'xeto://'));
    try {
        libInfoCompiler.run(libXeto + '\0');
    }
    catch (e) {
        console.log(e);
    }
    const libVersion = libInfoCompiler.root?.children['pragma']?.children._version.type || 'unknown';
    const libDoc = libInfoCompiler.root?.children['pragma']?.doc || '';
    const lib = new XetoLib_1.XetoLib(libInfo.name, libVersion, libInfoUri.replace('https://', 'xeto://'), libDoc);
    lib.includePriority = -1;
    // now that we have the lib read all the files
    const filesPr = libInfo.files.map(async (fileName) => {
        const uri = `${baseURL}/${libInfo.name}/${fileName}`;
        const compiler = new Compiler_1.ProtoCompiler(uri.replace('https://', 'xeto://'));
        const content = await utils_1.readUrl(uri);
        compiler.run(content + '\0');
        if (!compiler.root) {
            return;
        }
        Object.entries(compiler.root.children).forEach(([name, proto]) => {
            lib.addChild(name, proto);
        });
    });
    await Promise.all(filesPr);
    lm.addLib(lib);
    processSysLibNo(baseURL, lm, index + 1);
};
exports.loadSysLibsFromGH = (sha, lm) => {
    const baseURL = `https://raw.githubusercontent.com/haxall/haxall/${sha}/src/xeto`;
    processSysLibNo(baseURL, lm, 0);
};
//# sourceMappingURL=SysLibs.js.map