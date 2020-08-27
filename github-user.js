'use strict'

const 	{Octokit} 		= 	require('@octokit/rest'),
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

	constructor(){

		cacheCalls(this, 'get'				, 2000)
		cacheCalls(this, 'getInstallations'	, 2000)

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


		console.log(token)

		const octokit = new Octokit({auth:token})

		var result = await	octokit.users.getAuthenticated()


		return result.data	
	}


	/**
	 * Get data for all installations granted access to by provided access token.
	 *
	 * This method is augumented by {@link module:docloop#cache}(2000) return value will be cached for 2 seconds in order to prevent huge numbers of API calls.
	 * 
	 * @param  {String}		token		Github user access token
	 * @return {Object[]}				Installation id of each accessible installation
	 */
	async getInstallations(token){

		if(typeof token != 'string') throw TypeError('GithubUser.getInstallations() token must be a string; got: ' +token)

		const octokit = new Octokit({auth:token})


		var response 		= 	await octokit.apps.listInstallationsForAuthenticatedUser({per_page: 100}),
			installations	=	response.data.installations || []


		//TODO: handle more than 100 installations...

		return installations.map(installation => installation.id)
	}

	// async getRepositories(token){
	// 	if(typeof token != 'string') throw TypeError('GithubUser.getIRepositories() token must be a string; got: ' +token)

	// 	const octokit = new Octokit({auth:token})

	// 	var response 		= 	await octokit.repos.listForAuthenticatedUser({per_page: 100})

	// 	console.log(response)

	// 	return []
	// }


}

module.exports = GithubUser