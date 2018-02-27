# GithubAdapter


This package is meant to be used with [docloop](https://github.com/docloop/core).

Install like this:

    npm install docloop-github-adapter


Before you can actually use the GithubAdapter, you will have to register a [GithubApp](https://developer.github.com/apps/).
Each installation of the GithubApp needs acces to issues. 

Use the credential from yor app's configuration page to configure your GithubAdapter like this (see [docloop](https://github.com/docloop/core)):


```javascript
var PaperhiveAdapter = require('docloop-paperhive-adapter').PaperhiveAdapter 

docloopCore
.use(GithubAdapter, {
    name:             'GitHub',
    app:              {
                        id:                 0000,
                        secret:             "some_secret",
                        privateKeyLocation: "my_secret.private-key.pem",
                        installationLink:   "link_to_my_github_app",
                      },

    extraEndpoints:   false,
    eventQueue:       {
                        delay:            [0, 1000, 5000],
                        minDelay:         0,
                        maxAttempts:      3,
                        processInterval:  10*60*1000,
                        spread:           1000,
                      },
    oAuth:            {
                        clientId:       "github_app_client_id",
                        clientSecret:   "github_app_client_secret",
                        accessTokenUrl: "https://github.com/login/oauth/access_token",                  
                        authUrl:        "https://github.com/login/oauth/authorize?scope=user:email&client_id={{github_app_client_id}}",
                      },
    dummy:            {
                        title:  "docLoop: dummy",
                        body: "_docLoop: dummy for missing parent_"
                      }
})
```

Here's the documentation: [docloopDocs](https://docloop.net/docs)