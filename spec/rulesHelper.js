const Promise = require('bluebird');
const path = require('path');
const fse = Promise.promisifyAll(require('fs-extra'));

const ACCESS_RULES_FILE_PATH = path.join(process.cwd(), 'access-rules.js');
const ALTERNATIVE_RULES_FILE_PATH = path.join(process.cwd(), 'whatever.js');

module.exports = class {
  createRulesFile() {
    this.rules = this.getSampleRules();
    const content = `module.exports = ${JSON.stringify(this.rules)};`;
    return fse.writeFileAsync(ACCESS_RULES_FILE_PATH, content);
  }

  createAlternativeRulesFile() {
    this.rules = this.getSampleRules();
    const content = `module.exports = ${JSON.stringify(this.rules)};`;
    return fse.writeFileAsync(ALTERNATIVE_RULES_FILE_PATH, content);
  }

  removeMainRulesFile() {
    return fse.unlinkAsync(ACCESS_RULES_FILE_PATH);
  }

  removeRulesFiles() {
    return Promise.any([
      fse.unlinkAsync(ACCESS_RULES_FILE_PATH),
      fse.unlinkAsync(ALTERNATIVE_RULES_FILE_PATH),
    ]);
  }

  getSampleRules() {
    this.customValidation = jasmine.createSpy('customValidation');
    return {
      'default': '$authenticated',
      'myapp.Greeter': {
        'sayHello': 'special',
        'sayHelloOther': 'other-app:special',
        'sayHelloRealm': 'realm:admin',
        'sayHelloCustom': this.customValidation,
        'sayHelloPublic': '$anonymous',
        'sayHelloMultiple': ['special', 'realm:admin', this.customValidation],
      },
    };
  }

  clearRequireCache() {
    delete require.cache[ACCESS_RULES_FILE_PATH];
    delete require.cache[ALTERNATIVE_RULES_FILE_PATH];
  }
};
