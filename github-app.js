'use strict'

const	createApp 	=	require('github-app'),
		cacheCalls	=	require('docloop').cacheCalls


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

	constructor(config){
		this.app = 	createApp(config)
		cacheCalls(this, 'getRepositories', 2000)
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

		var github 	= await this.app.asInstallation(installation_id),
			result	= await github.apps.getInstallationRepositories({}),
			repos	= result.data.repositories || []


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

		var params 			= 	{ 
									owner:	target_identifier.owner,
									repo:	target_identifier.repo,
									number:	issue.number,
									title:	issue.title,
									body:	issue.body,
									labels:	issue.labels
								},
			github 			= 	await this.app.asInstallation(target_identifier.installation_id),
			result 			=	issue.number 
								?	await github.issues.edit( params ) 
								:	await github.issues.create( params ) 

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

		console.log('creating/upadting comment', Date.now())


		var params			=	{
									owner:		target_identifier.owner,
									repo:		target_identifier.repo,
									number:		comment.number,
									body:		comment.body,
									id:			comment.id
								},
			github 			= 	await this.app.asInstallation(target_identifier.installation_id),
			result			=	comment.id	
								?	await github.issues.editComment( params )
								:	await github.issues.createComment( params )
			
		return result.data.id //todo?		
	}

}


module.exports = GithubApp