# condor-authorize

An authorization Middleware for [Condor](http://condorjs.com). **Condor** is a [GRPC Framework for node](https://github.com/devsu/condor-framework).

[![Build Status](https://travis-ci.org/devsu/condor-authorize.svg?branch=master)](https://travis-ci.org/devsu/condor-authorize)
[![Coverage Status](https://coveralls.io/repos/github/devsu/condor-authorize/badge.svg?branch=master)](https://coveralls.io/github/devsu/condor-authorize?branch=master)

This module control access to **GRPC methods**, based on the **access rules** defined.

## Installation

```bash
npm i --save condor-framework condor-authorize
```

## How to use

### Role-based authorization

Just two steps:

- Create a method that returns the roles / permissions the caller has.
- Define the [access rules](#access-rules)

```js
const Condor = require('condor-framework');
const jwt = require('condor-jwt');
const authorize = require('condor-authorize');
const Greeter = require('./greeter');

const jwtOptions = {
  'secretOrPublicKey': 'shhhhhh', 
  'passthrough': true,
};

const authorizeOptions = {
  'getPermissions': (context) => {
    // do your magic here to obtain the permissions/roles from 
    // the token (or from anywhere else).
    // You just need to return an array of strings.
    return ['user', 'admin', 'another-string:my-permission'];
  },
};

const app = new Condor()
  .addService('./protos/greeter.proto', 'myapp.Greeter', new Greeter())
  .use(jwt(jwtOptions))
  .use(authorize(authorizeOptions))
  .start();
```

As you can see, the example above uses [condor-jwt](https://github.com/devsu/condor-jwt) to decode and verify a JWT token. The token will be then accessible in `context.token`.

### Any other strategy

If you need more advanced authorization rules, you can skip the getPermissions method, and just use **custom validators** when defining the [access rules](#access-rules).

```js
const Condor = require('condor-framework');
const authorize = require('condor-authorize');
const Greeter = require('./greeter');

const app = new Condor()
  .addService('./protos/greeter.proto', 'myapp.Greeter', new Greeter())
  .use(authorize())
  .start();
```

## 2. Access Rules

By default, it will try to read the access rules from `access-rules.js`.

The rules file should export an object, with the full names of the services as keys. Also you can have a `default` key.

### Rules Example

This example will show you the available options:

```js
module.exports = {
  'default': '$authenticated',
  'myapp.Greeter': {
  	'sayHello': 'special',
  	'sayHelloOther': 'another:special',
  	'sayHelloCustom': customValidation,
  	'sayHelloPublic': '$anonymous',
  	'sayHelloMultiple': ['special', 'realm:admin', customValidation],
  },
};

function customValidation (ctx) => {
	if (ctx.token.payload.someKey === 'someValue' && ctx.metadata.get('anotherKey')[0] === 'anotherValue') {
		return true; // allow to continue
	}
	return false; // deny access
}
```

Using these rules, we're telling the application:

- By default, for every method not defined in the file, the user must be authenticated (without taking into account any roles).
- `sayHello` requires the user to have the `special` permission/role.
- `sayHelloOther` requires the user to have the `another:special` permission/role.
- `sayHelloCustom` access will be calculated by the `customValidation` method.
- `sayHelloPublic` will be public (`$anonymous`)
- `sayHelloMultiple` shows how you can pass not only one but an array of options to authorize the call. In this example, to authorize the method we are requiring any of these 3 conditions:

  - The user to have the `special` permission/role.
  - The user to have the `real:admin` permission/role.
  - The `customValidation` method to return true.

### Rules Available

#### $anonynous and $authenticated

You can use `$authenticated` to enforce a user to be authenticated before accessing the method (without verifying any roles). By default a user is considered authenticated when the token received in the metadata is valid.

On the other hand, you can use `$anonymous` to make a resource public. If you are using [condor-jwt](https://github.com/devsu/condor-jwt) make sure to use the `passthrough` option (Otherwise it will never reach to this middleware, and authorization won't be performed.)

#### String with the role/permission

It will be matched against the array returned by the `getPermissions` method.

#### Custom Validators

If you need some specific logic to authorize/deny access, just pass the function that must perform the validation (make sure to pass the actual function, not only the function name).

The validation function will be called with two parameters: 

- `context`: The context being processed.

The validation function must return a truthy value to allow access. Any falsy value will deny access.

#### Multiple options for a method

You can pass not only one option, but an array of options to authorize the call. If any of them pass, the call will be authorized.

#### How to require two roles/permissions? (use AND instead of OR)

You can use custom validation functions that do exactly what you want. You can have for example something like this:
 
 ```js
 module.exports = {
   'default': '$authenticated',
   'myapp.Greeter': {
   	'sayHelloCustom': tokenHasAllRoles('special', 'admin'),
   },
 };
 
function tokenHasAllRoles() {
  const roles = arguments;
  return (context) => {
    // Verify that the token has all the roles
    return roles.every((role) => {
      return context.token.payload.roles.contains(role);
    });
  };
}
 ```

## Options

All values are optional. Their default values are:

| Option             | Description                                                                                                        |
|--------------------|--------------------------------------------------------------------------------------------------------------------|
| rulesFile          | The path to the rules file. Default is `access-rules.js`                                                           |
| rules              | The access rules to use (can be used instead of rulesFile)                                                         |
| getPermissions     | Method to determine the permissions from the context. It receives the context, and must return (or resolve with) an array of strings.|
| isAuthenticated    | Method to determine if a user is authenticated. It receives the context, and must return (or resolve with) true/false. By default it will consider a call authenticated if context.token is set, false otherwise.|

## License and Credits

MIT License. Copyright 2017 

Built by the [GRPC experts](https://devsu.com) at Devsu.
