Authentication
In order to make use of the API you will need to have two things.

An application key, this is only supplied to those creating their own applications. In order to get one please fill this form
A User Authentication token, a user can generate a User Authentication token from their User API Tokens page
Both of them should be supplied with each call to the api as header variables under the keys x-application-key and x-auth-token respectively

Warning
It is your responsibility that the tokens above are not exposed to the public. All communications to and from the server are encrypted but your application should make sure these are kept safe.

Headers Setup
Finally keep in mind that all calls should also include in their header Content type application/json and a User-Agent with the name, url and version of the app.


x-auth-token: 9QxWuGXFsLX8RFyAcNayS7GRgJbU6vwQQQFwvODQdYMcFoPAP8vCuX //your user token 
x-application-key: Tt8RbuX7KDwfH4R2Y3  //your application key 
Content-type: application/json
User-Agent: $app_name ( $url, $version )
                                
Problems with CORS?
Although it is suggested that you use the headers for authentication, the same tokens with the same names can also be used as parameters to your calls. This is only suggested if for some reason you have issues with CORS while trying to connect.


GET https://www.worldanvil.com/api/external/boromir/user?x-application-key=USER_APPLICATION_KEY_HERE&x-auth-token=USER_AUTH_TOKEN_HERE HTTP/1.1
                                            
Endpoints
For the purposes of this documentation all endpoints are assumed to be prefixed by /api/external/boromir under the worldanvil domain. For example to get your identity informations you would use


GET https://www.worldanvil.com/api/external/boromir/identity HTTP/1.1
        
GET, PUT, POST, PATCH and DEL endpoints request and respond with JSON.
It is suggested that if needed, you use Content-type: application/json.
PUT, POST and PATCH do not use form-data to receive content.

Granularity
All GET endpoints have a granularity parameter.
This parameter is used to limit the amount of data that is returned by the get endpoints. If the parameter is not set, the default value is -1 in most case.
All GET endpoints have a granularity parameter.

The underlying logic behind it is the following:

-1 - a generic reference, shared by all entities.
This is the return of most listing function and generaly the "reference to other object". Mainly for internal usage and minimal listing.
0 - the minimum display object, contain data for displaying the entity in a preview or choice.
1 - the principal display object, contain data for displaying the entity in it's usual setting.
2 - the detailed object, contain linking data, related entity and other "advanced display" occurence (typically for edition of said links).
linked entities are returned as -1 granularity
3 - [rarely available] Expanded linking object / special display cases.

Some POST List endpoints or non standard GET endpoints may accept granularity setting, but availability is guaranteed only for the standard GET /entity endpoints.