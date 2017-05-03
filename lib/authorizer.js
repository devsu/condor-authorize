const path = require('path');

const UNAUTHENTICATED_CODE = 16;
const PERMISSION_DENIED_CODE = 7;
const DEFAULT_OPTIONS = {
  'rulesFile': 'access-rules.js',
};

module.exports = class {
  constructor(options) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    if (this.options.getPermissions) {
      this.getPermissions = options.getPermissions;
    }
    if (this.options.isAuthenticated) {
      this.isAuthenticated = options.isAuthenticated;
    }
    if (this.options.isAllowed) {
      this.isAllowed = options.isAllowed;
    }
    this.rules = this._buildRules();
  }
  _buildRules() {
    const rules = this.options.rules || this._loadFile(this.options.rulesFile);
    const optimized = [];
    Object.keys(rules).forEach((serviceName) => {
      optimized[serviceName] = this._optimizeRules(rules[serviceName]);
    });
    return optimized;
  }

  _optimizeRules(rules) {
    // Optimizing for isAllowedMethod() to be fastes.
    // Arrays are slightly faster than objects, all
    // rules are converted to arrays
    if (typeof rules === 'string' || rules instanceof String || rules instanceof Function) {
      return [rules];
    }
    if (Array.isArray(rules)) {
      return rules;
    }
    const rulesForMethod = [];
    Object.keys(rules).forEach((methodName) => {
      if (Array.isArray(rules[methodName])) {
        rulesForMethod[methodName] = rules[methodName];
        return;
      }
      rulesForMethod[methodName] = [rules[methodName]];
    });
    return rulesForMethod;
  }

  _loadFile(filePath) {
    return require(path.join(process.cwd(), filePath));
  }

  isAllowed(context, roles) {
    const serviceFullName = context.properties.serviceFullName;
    const methodName = context.properties.methodName;
    const rulesFound = this._findRulesForMethod(serviceFullName, methodName);
    const matchingRule = rulesFound.find((rule) => {
      return this._ruleMatches(rule, roles, context);
    });
    return Boolean(matchingRule);
  }

  _findRulesForMethod(serviceFullName, methodName) {
    if (this.rules[serviceFullName] && this.rules[serviceFullName][methodName]) {
      return this.rules[serviceFullName][methodName];
    }
    if (this.rules.default) {
      return this.rules.default;
    }
    return [];
  }

  _ruleMatches(rule, roles, context) {
    if (rule === '$anonymous') {
      return true;
    }
    if (rule === '$authenticated' && this.isAuthenticated(context)) {
      return true;
    }
    if (rule instanceof Function) {
      try {
        return rule.call(null, context, context.token);
      } catch (e) {
        console.error('Error in custom method, denying access', context.properties, e);
        return false;
      }
    }
    return (roles.indexOf(rule) >= 0);
  }

  getMiddleware() {
    return (context, next) => {
      return Promise.resolve().then(() => {
        return this.getPermissions(context);
      }).then((permissions) => {
        return Promise.all([
          this.isAllowed(context, permissions),
          this.isAuthenticated(context),
        ]);
      }).then(([isAllowed, isAuthenticated]) => {
        if (isAllowed) {
          return next();
        }
        if (isAuthenticated) {
          throw {
            'code': PERMISSION_DENIED_CODE,
            'details': 'Permission Denied',
          };
        }
        throw {
          'code': UNAUTHENTICATED_CODE,
          'details': 'Unauthenticated',
        };
      });
    };
  }

  getPermissions() {
    // return an empty array by default
    return [];
  }

  isAuthenticated(context) {
    return Boolean(context.token);
  }
};
