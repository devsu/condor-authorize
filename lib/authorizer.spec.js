const Spy = require('jasmine-spy');
const Authorizer = require('./authorizer');
const RulesHelper = require('../spec/rulesHelper');

describe('Authorizer', () => {
  let authorizer, options, rulesHelper;

  beforeEach((done) => {
    options = {};
    rulesHelper = new RulesHelper();
    Promise.all([
      rulesHelper.createRulesFile(),
    ]).then(done).catch(done.fail);
  });

  afterEach((done) => {
    Promise.all([
      rulesHelper.removeRulesFiles(),
    ]).then(done).catch(done);
  });

  describe('constructor()', () => {
    beforeEach(() => {
      rulesHelper.clearRequireCache();
    });

    describe('without options', () => {
      it('should read rules from access-rules.js', () => {
        // Hacky way of testing
        /* eslint-disable no-underscore-dangle */
        const originalFileLoad = Authorizer.prototype._loadFile;
        Authorizer.prototype._loadFile = Spy.returnValue({});
        authorizer = new Authorizer();
        expect(authorizer._loadFile).toHaveBeenCalledTimes(1);
        expect(authorizer._loadFile).toHaveBeenCalledWith('access-rules.js');
        Authorizer.prototype._loadFile = originalFileLoad;
        /* eslint-enable no-underscore-dangle */
      });

      describe('when access-rules.js file is not present', () => {
        beforeEach((done) => {
          rulesHelper.removeRulesFiles().then(done).catch(done.fail);
        });

        it('should throw an error', () => {
          expect(() => {
            authorizer = new Authorizer();
          }).toThrowError(/access-rules\.js/g);
        });
      });
    });

    describe('with options', () => {
      beforeEach(() => {
        options = {'foo': 'baz'};
      });

      it('should add options to default options', () => {
        authorizer = new Authorizer(options);
        expect(authorizer.options).toEqual(jasmine.objectContaining(options));
      });
    });

    describe('options: "rulesFile"', () => {
      beforeEach(() => {
        options = {'rulesFile': 'whatever.js'};
      });

      it('should try to read the configuration from such file', () => {
        // Hacky way of testing
        /* eslint-disable no-underscore-dangle */
        const originalFileLoad = Authorizer.prototype._loadFile;
        Authorizer.prototype._loadFile = Spy.returnValue({});
        authorizer = new Authorizer(options);
        expect(authorizer._loadFile).toHaveBeenCalledTimes(1);
        expect(authorizer._loadFile).toHaveBeenCalledWith('whatever.js');
        Authorizer.prototype._loadFile = originalFileLoad;
        /* eslint-enable no-underscore-dangle */
      });
    });

    describe('options: "rules"', () => {
      beforeEach(() => {
        options = {'rules': {'foo': 'bar'}};
      });
      it('should use the passed rules instead of reading a file', () => {
        authorizer = new Authorizer(options);
        expect(options.rules).toEqual(options.rules);
      });
    });

    describe('options: "getPermissions"', () => {
      let permissions;
      beforeEach(() => {
        permissions = ['a', 'b', 'c'];
        options = {'getPermissions': Spy.returnValue(permissions)};
      });
      it('must override getPermissions method', () => {
        authorizer = new Authorizer(options);
        expect(authorizer.getPermissions()).toEqual(permissions);
      });
    });

    describe('options: "isAuthenticated"', () => {
      let isAuthenticated;
      beforeEach(() => {
        isAuthenticated = Spy.create();
        options = {isAuthenticated};
      });
      it('must override isAuthenticated method', () => {
        authorizer = new Authorizer(options);
        expect(authorizer.isAuthenticated).toEqual(isAuthenticated);
      });
    });

    describe('options: "isAllowed"', () => {
      let isAllowed;
      beforeEach(() => {
        isAllowed = Spy.create();
        options = {isAllowed};
      });
      it('must override isAllowed method', () => {
        authorizer = new Authorizer(options);
        expect(authorizer.isAllowed).toEqual(isAllowed);
      });
    });

    it('should optimize rules', () => {
      const customValidator = Spy.create();
      const rules = {
        'default': '$authenticated',
        'another': ['$anonymous'],
        'my.app.Service': {
          'myMethod': 'asd',
          'another': customValidator,
          'yetAnother': ['asd:asd', customValidator],
        },
      };
      const expectedRules = [];
      expectedRules.default = ['$authenticated'];
      expectedRules.another = ['$anonymous'];
      expectedRules['my.app.Service'] = [];
      expectedRules['my.app.Service'].myMethod = ['asd'];
      expectedRules['my.app.Service'].another = [customValidator];
      expectedRules['my.app.Service'].yetAnother = ['asd:asd', customValidator];
      options = {rules};
      authorizer = new Authorizer(options);
      expect(authorizer.rules).toEqual(expectedRules);
    });
  });

  describe('isAllowed()', () => {
    let serviceFullName, methodName, methodFullName, roles, context, properties;

    beforeEach(() => {
      serviceFullName = 'myapp.Greeter';
      methodName = 'sayHello';
      methodFullName = `${serviceFullName}.${methodName}`;
      properties = {serviceFullName, methodName, methodFullName};
      context = {properties};
      options.rules = {};
      options.rules[serviceFullName] = {};
      roles = [];
    });

    describe('resource is NOT defined in the rules', () => {
      beforeEach(() => {
        delete options.rules[serviceFullName];
      });
      it('should not fail', () => {
        authorizer = new Authorizer(options);
        authorizer.isAllowed(context, roles);
      });
    });

    describe('method is NOT defined in the rules', () => {
      describe('default is defined', () => {
        it('should calculate access using the default rule', () => {
          // 1
          options.rules = {'default': '$authenticated'};
          authorizer = new Authorizer(options);
          context.token = {};
          expect(authorizer.isAllowed(context, roles)).toBeTruthy();
          // 2
          options.rules = {'default': '$authenticated'};
          authorizer = new Authorizer(options);
          delete context.token;
          expect(authorizer.isAllowed(context, roles)).toBeFalsy();
          // 3
          options.rules = {'default': '$anonymous'};
          authorizer = new Authorizer(options);
          expect(authorizer.isAllowed(context, roles)).toBeTruthy();
          // 4
          options.rules = {'default': 'ffff'};
          authorizer = new Authorizer(options);
          roles = [];
          expect(authorizer.isAllowed(context, roles)).toBeFalsy();
        });
      });
      describe('default is NOT defined', () => {
        // By default we deny access
        it('should deny access', () => {
          authorizer = new Authorizer(options);
          expect(authorizer.isAllowed(context, roles)).toBeFalsy();
        });
      });
    });

    describe('rule: $anonymous', () => {
      beforeEach(() => {
        options.rules[serviceFullName][methodName] = '$anonymous';
        authorizer = new Authorizer(options);
      });
      it('should allow access', () => {
        expect(authorizer.isAllowed(context, roles)).toBeTruthy();
      });
    });

    describe('rule: $authenticated', () => {
      beforeEach(() => {
        options.rules[serviceFullName][methodName] = '$authenticated';
        authorizer = new Authorizer(options);
      });
      describe('user is authenticated', () => {
        beforeEach(() => {
          authorizer.isAuthenticated = Spy.returnValue(true);
        });
        it('should allow access', () => {
          expect(authorizer.isAllowed(context, roles)).toBeTruthy();
        });
      });
      describe('user is NOT authenticated', () => {
        beforeEach(() => {
          authorizer.isAuthenticated = Spy.returnValue(false);
        });
        it('should NOT allow access', () => {
          expect(authorizer.isAllowed(context, roles)).toBeFalsy();
        });
      });
    });

    describe('rule: role', () => {
      beforeEach(() => {
        options.rules[serviceFullName][methodName] = 'role1';
        authorizer = new Authorizer(options);
      });
      describe('user has role', () => {
        beforeEach(() => {
          roles = ['role1'];
        });
        it('should allow access', () => {
          expect(authorizer.isAllowed(context, roles)).toBeTruthy();
        });
      });
      describe('user does NOT have role', () => {
        it('should deny access', () => {
          expect(authorizer.isAllowed(context, roles)).toBeFalsy();
        });
      });
    });

    describe('rule: Function()', () => {
      let customValidator;
      beforeEach(() => {
        customValidator = Spy.create();
        options.rules[serviceFullName][methodName] = customValidator;
        authorizer = new Authorizer(options);
      });
      it('should call the validator with the context and token', () => {
        authorizer.isAllowed(context, roles);
        expect(customValidator).toHaveBeenCalledTimes(1);
        expect(customValidator).toHaveBeenCalledWith(context, authorizer.token);
      });
      it('should return the same value the function returns', () => {
        customValidator.and.returnValue(true);
        expect(authorizer.isAllowed(context, roles)).toEqual(true);
        customValidator.and.returnValue(false);
        expect(authorizer.isAllowed(context, roles)).toEqual(false);
      });
      describe('when function throws an error', () => {
        let originalConsoleError, error;
        beforeEach(() => {
          originalConsoleError = console.error;
          console.error = Spy.create();
          error = new Error('whatever');
          customValidator.and.throwError(error);
        });
        afterEach(() => {
          console.error = originalConsoleError;
        });
        it('should log the error', () => {
          authorizer.isAllowed(context, roles);
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledWith('Error in custom method, denying access',
            context.properties, error);
        });
        it('should deny access', () => {
          expect(authorizer.isAllowed(context, roles)).toEqual(false);
        });
      });
    });

    describe('rule: Array', () => {
      beforeEach(() => {
        options.rules[serviceFullName][methodName] = ['app:a', 'other:b'];
        authorizer = new Authorizer(options);
      });
      describe('at least one of the rules pass', () => {
        beforeEach(() => {
          roles = ['other:b'];
        });
        it('should allow access', () => {
          expect(authorizer.isAllowed(context, roles)).toBeTruthy();
        });
      });
      describe('no rule passes', () => {
        it('should deny access', () => {
          expect(authorizer.isAllowed(context, roles)).toBeFalsy();
        });
      });
    });
  });

  describe('getMiddleware()', () => {
    beforeEach(() => {
      authorizer = new Authorizer(options);
    });

    it('should return a middleware method', () => {
      expect(authorizer.getMiddleware()).toEqual(jasmine.any(Function));
    });
  });

  describe('getPermissions', () => {
    beforeEach(() => {
      authorizer = new Authorizer(options);
    });
    it('it must return an empty array', () => {
      expect(authorizer.getPermissions()).toEqual([]);
    });
  });

  describe('isAuthenticated', () => {
    let context;
    beforeEach(() => {
      context = {};
      authorizer = new Authorizer(options);
    });
    describe('context.token is defined', () => {
      beforeEach(() => {
        context.token = {};
      });
      it('it must return true', () => {
        expect(authorizer.isAuthenticated(context)).toEqual(true);
      });
    });
    describe('context.token is undefined', () => {
      beforeEach(() => {
        delete context.token;
      });
      it('it must return false', () => {
        expect(authorizer.isAuthenticated(context)).toEqual(false);
      });
    });
  });

  describe('middleware', () => {
    let roles, context, next, middleware;

    beforeEach(() => {
      roles = ['one', 'two'];
      context = {'token': {'a': 'b'}};
      next = Spy.resolve();
      authorizer = new Authorizer(options);
      middleware = authorizer.getMiddleware();
    });

    it('should call getPermissions with the right parameters', (done) => {
      authorizer.getPermissions = Spy.returnValue(roles);
      authorizer.isAllowed = Spy.returnValue(true);
      middleware.call(null, context, next).then(() => {
        expect(authorizer.getPermissions).toHaveBeenCalledTimes(1);
        expect(authorizer.getPermissions).toHaveBeenCalledWith(context);
        done();
      });
    });

    it('should call isAllowed with the right parameters', (done) => {
      authorizer.getPermissions = Spy.returnValue(roles);
      authorizer.isAllowed = Spy.returnValue(true);
      middleware.call(null, context, next).then(() => {
        expect(authorizer.isAllowed).toHaveBeenCalledTimes(1);
        expect(authorizer.isAllowed).toHaveBeenCalledWith(context, roles);
        done();
      });
    });

    describe('when is allowed', () => {
      beforeEach(() => {
        authorizer.isAllowed = Spy.returnValue(true);
      });
      it('should call next', (done) => {
        middleware.call(null, context, next).then(() => {
          expect(next).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });

    describe('when is not allowed', () => {
      beforeEach(() => {
        authorizer.isAllowed = Spy.returnValue(false);
      });

      it('should not call next', (done) => {
        middleware.call(null, context, next).then(fail).catch(() => {
          expect(next).not.toHaveBeenCalled();
          done();
        });
      });

      it('should call isAuthenticated with the right parameters', (done) => {
        authorizer.isAuthenticated = Spy.create();
        middleware.call(null, context, next).then(fail).catch(() => {
          expect(authorizer.isAuthenticated).toHaveBeenCalledTimes(1);
          expect(authorizer.isAuthenticated).toHaveBeenCalledWith(context);
          done();
        });
      });

      describe('when is not authenticated', () => {
        beforeEach(() => {
          authorizer.isAuthenticated = Spy.returnValue(false);
        });
        it('should throw error with code: Unauthenticated', (done) => {
          middleware.call(null, context, next).then(fail).catch((e) => {
            expect(e.code).toEqual(16);
            expect(e.details).toEqual('Unauthenticated');
            done();
          });
        });
      });

      describe('when is authenticated', () => {
        beforeEach(() => {
          authorizer.isAuthenticated = Spy.returnValue(true);
        });
        it('should throw error with code: PermissionDenied', (done) => {
          middleware.call(null, context, next).then(fail).catch((e) => {
            expect(e.code).toEqual(7);
            expect(e.details).toEqual('Permission Denied');
            done();
          });
        });
      });
    });

    describe('when getPermissions returns a promise', () => {
      beforeEach(() => {
        authorizer.getPermissions = Spy.resolve(roles);
      });
      it('should still work', (done) => {
        authorizer.isAllowed = Spy.returnValue(true);
        middleware.call(null, context, next).then(() => {
          expect(authorizer.isAllowed).toHaveBeenCalledWith(context, roles);
          done();
        });
      });
    });

    describe('when isAllowed returns a promise', () => {
      beforeEach(() => {
        authorizer.isAllowed = Spy.resolve(false);
      });
      it('should still work', (done) => {
        middleware.call(null, context, next).then(fail).catch(() => {
          done();
        });
      });
    });

    describe('when isAuthenticated returns a promise', () => {
      beforeEach(() => {
        authorizer.isAllowed = Spy.returnValue(false);
        authorizer.isAuthenticated = Spy.resolve(false);
      });

      it('should still work', (done) => {
        middleware.call(null, context, next).then(fail).catch((e) => {
          // unauthenticated
          expect(e.code).toEqual(16);
          done();
        });
      });
    });
  });
});
