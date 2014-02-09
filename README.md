user-api-client
===============

# Docs
This is a library that makes it easier for servers that are talking to the 
Tidepool User API.

# Setup
```require('user-api-client')(config, hostGetter, request);```

  * ```config``` -- an object containing configuration parameters
  * ```hostGetter``` -- an object from hakken
  * ```request``` -- (optional) -- the result of require('request'). If not supplied a new one will be created.
  
  Generates a client object with the following methods:
 

* ```checkToken (token, cb)```
*Frontend to the API call to check the validity of a server or user token*
    * ```token``` -- the server token to be checked
    * ```cb (err, response)```
        * ```err``` -- null if no error, else an object
        * ```response``` -- result from the /user/token api call
    

* ```createUser (userObj, cb)```
*Frontend to the API call to create a user*
    * ```userObj``` -- object containing username, emails and password fields at minimum
    * ```cb (err, response)```
        * ```err``` -- null if no error, else an error object
        * ```response``` -- result from the /user/user api call
    

* ```login (username, password, cb)```
*Frontend to the API call to log in a user*
    * ```username``` -- string
    * ```password``` -- password
    * ```cb (err, response)```
        * ```err``` -- null if no error, else an error object
        * ```response``` -- result from the /user/login api call
    

* ```getMetaPair (userid, cb)```
*Frontend to the API call to retrieve the (id, hash) pair called 'meta' from the user/private object*
    * ```userid``` -- Tidepool-assigned userid
    * ```cb (err, response)```
        * ```err``` -- null if no error, else an error object
        * ```response``` -- result from the /user/private/:userid/meta api call
    

* ```getAnonymousPair (userid, cb)```
*Frontend to the API call to retrieve a pair from the user object without storing it*
    * ```userid``` -- Tidepool-assigned userid
    * ```cb (err, response)```
        * ```err``` -- null if no error, else an error object
        * ```response``` -- result from the /user/private api call
    

* ```withServerToken (cb)```
*Calls CB with a valid server token, iff one can be retrieved*
    * ```cb (err, token)```
        * ```err``` -- always null if callback is called at all
        * ```token``` -- a valid server token
    
