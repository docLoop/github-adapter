'use strict'

const 	GithubApi		=	require('github'),
		cacheCalls		=	require('docloop').cacheCalls
		
/**
 * Class representing minimal Github API wrapper for user interaction.
 *
 * @memberOf  	module:githubAdapter
 * @alias		GithubUser
 *
 * @property	github			Instance of GitHubApi (TODO: add link) 
 */
class GithubUser {

	//TODO: Multiple pages!


	constructor(){
		this.github = new GithubApi()

		cacheCalls(this, 'get'				, 2000)
		cacheCalls(this, 'getInstallations'	, 10000)

	}

	/**
	 * Get Github user data. 
	 *
	 * This method is augumented by {@link module:docloop#cache}(2000) return value will be cached for 2 seconds in order to prevent huge numbers of API calls.
	 * 
	 * @async
	 * @param  {String}		token	Github user access token
	 * @return {Object}				Github user data
	 *
	 * @throws	{TypeError}			If token is not a string.
	 */
	async get(token){


		if(typeof token != 'string') throw TypeError('GithubUser.get() token must be a string; got:' +token)

		this.github.authenticate( { type: 'oauth', token } )

		var result = await	this.github.users
							.get({})

		return result.data	
	}


	//TODO: Multiple Pages!

	/**
	 * Get data for all installations granted access to by provided access token.
	 *
	 * This method is augumented by {@link module:docloop#cache}(10000) return value will be cached for 2 seconds in order to prevent huge numbers of API calls.
	 * 
	 * @param  {String}		token		Github user access token
	 * @return {Object[]}				Installation id of each accessible installation
	 */
	async getInstallations(token){

		if(typeof token != 'string') throw TypeError('GithubUser.getInstallations() token must be a string; got: ' +token)

		this.github.authenticate( { type: 'oauth', token } )

		var result = await	this.github.users
							.getInstallations({})

		return result.data.installations.map(installation => installation.id)
	}


}

module.exports = GithubUser