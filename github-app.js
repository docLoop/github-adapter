'use strict'

const	jwt 			= 	require('jsonwebtoken'),
		{Octokit}		= 	require('@octokit/rest'),
		cacheCalls		=	require('docloop').cacheCalls,
		serializeCalls	=	require('docloop').serializeCalls






function generateJwt (id, cert) {
    const payload = {
      iat: Math.floor(new Date() / 1000),       
      exp: Math.floor(new Date() / 1000) + 60,  
      iss: id                                   
    }

    // Sign with RSA SHA256
    return jwt.sign(payload, cert, {algorithm: 'RS256'})
}




/**
 * Class representing minimal Github API wrapper for app interaction.
 *
 * @memberof  	module:githubAdapter
 * @alias		GithubApp
 * 
 * @param		{Object}		config
 * @param		{String}		config.id		GithubApp Id
 * @param		{String}		config.cert		GithubApp private key data
 *
 * @property 	{Object} 		app 			Instance of github-app (TODO:add link)
 * 
 */
class GithubApp {

	//TODO: Multiple pages!
	//
	//TODO: test rate limit



	//TOSO: store installation tokens for some time and reuse them
	
	constructor(config){
		this.id 		= config.id
		this.cert 		= config.cert


		//TODO: better use webwooks and reloads no need for cache:
		cacheCalls(this, 'getRepositories', 2000)


		serializeCalls(this, ['createOrUpdateIssue', 'createOrUpdateComment'], 3000)
	}




	async authenticateAsApp(){
		const octokit	= new Octokit({auth: generateJwt(this.id, this.cert)})
	    return octokit
	}


	async authenticateAsInstallation(installation_id){

		const octokit = await this.authenticateAsApp()

		const response = await octokit.apps.createInstallationAccessToken({installation_id})

		return new Octokit({auth: response.data.token}) 
	}




	/**
	 * Get all repositories the installation has access to.
	 * 
	 * This method is augumented by {@link module:docloop#cache}(2000). Return values will be cached for 2 seconds, to prevent huge numbers of API calls.
	 * 
	 * @param  {String}		installation_id		GithubApp installation id
	 * @return {Object[]}						For each repository a subset of the data provided by github.
	 */
	async getRepositories(installation_id){

		const octokit = await this.authenticateAsInstallation(installation_id)


		var	response	= await octokit.apps.listReposAccessibleToInstallation({per_page: 100}),
			repos		= response.data.repositories || []


		//TODO: HANDLE MORE THAN 100 PAGES

		return 	repos.map( repository => ({
					name:				repository.name,
					full_name:			repository.full_name,
					owner:				repository.owner,
					installation_id:	installation_id,
					html_url:			repository.html_url
				}))
	}

	/**
	 * Create or Update an Issue. If issue.number is provided, update the corresponding issue, otherwise create a new one .
	 * 
	 * @param  {Identifier}		target_identifier	Identifier pointing at a github repository
	 * @param  {Issue}			issue				
	 * @return {String}								The github issue number
	 */
	async createOrUpdateIssue(target_identifier, issue){

		console.log('creating/upadating issue', issue.title, Date.now())

		const octokit = await this.authenticateAsInstallation(target_identifier.installation_id)

		var params 			= 	{ 
									owner:	target_identifier.owner,
									repo:	target_identifier.repo,
									number:	issue.number,
									title:	issue.title,
									body:	issue.body,
									labels:	issue.labels
								},
			result 			=	issue.number 
								?	await octokit.issues.update( params ) 
								:	await octokit.issues.create( params ) 

		console.log('done', issue.title)

		return result.data.number
	}

	/**
	 * Create or update an Issue. If comment.id is provided, update the corresponding comment, otherwise create a new one.
	 * 
	 * @param  {Identifier}		target_identifier	Identifier pointing at a github repository
	 * @param  {Comment}		comment				
	 * @return {String}								The github comment number
	 */
	async createOrUpdateComment(target_identifier, comment){

		console.log('creating/updating comment', Date.now())

		const octokit = await this.authenticateAsInstallation(target_identifier.installation_id)

		var params			=	{
									owner:		target_identifier.owner,
									repo:		target_identifier.repo,
									number:		comment.number,
									body:		comment.body,
									id:			comment.id
								},
			result			=	comment.id	
								?	await octokit.issues.updateComment( params )
								:	await octokit.issues.createComment( params )
			
		return result.data.id //todo?		
	}

}


module.exports = GithubApp