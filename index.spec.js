const proxyquire = require('proxyquire');
const Spy = require('jasmine-spy');

describe('authorize()', () => {
  let options, authorize, AuthorizerStub, middleware;

  beforeEach(() => {
    AuthorizerStub = class {
      constructor(opt) {
        expect(opt).toEqual(options);
      }
    };
    middleware = Spy.create();
    AuthorizerStub.prototype.getMiddleware = Spy.returnValue(middleware);
    options = {'rules': {}};
    authorize = proxyquire('./index', {'./lib/authorizer': AuthorizerStub});
  });

  it('must return middleware method', () => {
    expect(authorize(options)).toEqual(middleware);
  });
});
