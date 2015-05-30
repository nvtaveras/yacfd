var request = require('request');
var cheerio = require('cheerio');
var program = require('commander');

var fs = require('fs');
var util = require('util');

var pkg = require('./package');

program
	.version(pkg.version)
	.option('-a, --handle [handle]', 'Contestant handle')
	.parse(process.argv);

if (!program.handle) {
	program.help(); // Exits program after showing help.
}

var HANDLE = program.handle;
var DOWNLOAD_FOLDER = 'Solutions';
var OUTPUT_FOLDER = __dirname + '/' + DOWNLOAD_FOLDER;

var BASE_URL = 'http://codeforces.com/';
var BASE_API_URL = BASE_URL + 'api/';
var CONTESTS_URL = BASE_API_URL + 'contest.list';
var SUBMISSIONS_URL = BASE_API_URL + 'user.status?handle=%s';
var SUBMISSION_URL = BASE_URL + 'contest/%d/submission/%d';

var contestList = {};

// Step 1: Create the downloads folder
createDownloadFolder();

// Step 2: Fetch all the contests from the Codeforces API
req( CONTESTS_URL, function(contests){
	console.log("Successfully loaded " + contests.length + ' ' + 'contests');
	for(var i = 0; i < contests.length; ++i){
		var contest = contests[i];
		var contestName = contest.name;
		var contestID = contest.id;
		var phase = contest.phase;
		if(phase == "FINISHED"){
			contestList[contestID] = {
				name    : contestName
			};
		}
	}

	// Step 3: Fetch all the submissions made by HANDLE from the Codeforces API
	req( getAllSubmissionsUrl(HANDLE), function(submissions){
		console.log("Successfully loaded " + submissions.length + ' ' + 'submissions');

		// Step 4: Download all the solutions and save them to DOWNLOAD_FOLDER
		download(submissions, function() {
			console.log('Finished downloading everything!');
		});
	});
});

function createDownloadFolder(){
    // Check if the folder doesn't exist before creating it.
    if(!fs.existsSync(OUTPUT_FOLDER)){
        fs.mkdirSync(DOWNLOAD_FOLDER);
    }
}

function createOutputFolder(contestName){
    fs.mkdirSync(util.format(OUTPUT_FOLDER + '/%s', contestName));
}

function download(submissionsQueue, callback){
	if(submissionsQueue.length > 0){
		var submission = submissionsQueue.shift();
		var submissionID = submission.id;
		var submissionLang = submission.programmingLanguage;
		var submissionContestID = submission.contestId;

		if(contestList.hasOwnProperty(submissionContestID)){
			var testSet = submission.testset;
			var verdict = submission.verdict;
			var alpha = submission.problem.index;

			if(testSet == "TESTS" && verdict == "OK"){
				(function(idContest, idSubmission, alphaLetter, lang){
					getSubmissionCode(idContest, idSubmission, function(err, code){
						if(!err){
							console.log("Processing problem [" + alphaLetter + "] from " + contestList[idContest].name);
							saveSolution(contestList[idContest].name, alphaLetter, code, lang, function(){
                                // Save and keep downloading the rest of the submissions
								download(submissionsQueue, callback);
							});
						}else{
                            // Couldn't get submission code for some reason.. keep processing the rest
							console.log("Error downloading problem [" + alphaLetter + "] from " + contestList[idContest].name);
                            download(submissionsQueue, callback);
						}
					});
				})(submissionContestID, submissionID, alpha, submissionLang);
			}else{
                // If this submission wasn't accepted by CF ignore it and keep downloading the remaining
				download(submissionsQueue, callback);
			}
		}else{
            // If the contest is 'unknown', ignore the submission
			download(submissionsQueue, callback);
		}
	}else{
        // All the submissions were processed (hopefully successfully)
		callback();
	}
}

function getExtension(language){
	var ext = "";
	switch(language){
	case "GNU C++":
		ext = ".cpp";
	break;
	case "GNU C++11":
		ext = ".cpp";
	break;
	case "MS C++":
		ext = ".cpp";
	break;
	case "GNU C":
		ext = ".c";
	break;
	case "GNU C11":
		ext = ".c";
	break;
	case "Java 7":
		ext = ".java";
	break;
	case "Java 8":
		ext = ".java";
	break;
	case "Python 3":
		ext = ".py"
	break;
	case "Python 2":
		ext = ".py"
	break;
	case "Ruby":
		ext = ".rb";
	break;
	default:
		ext = ".txt";
	}
	return ext;
}

function saveSolution(contestName, alpha, code, lang, callback){
    var contestPath = util.format(OUTPUT_FOLDER + '/%s', contestName),
        filePath = util.format(contestPath + '/%s' + getExtension(lang), alpha);

	// Replace some illegal characters first. As of 05/28/2015, only about 5 contests contain them :)
	contestName = contestName.replace(/[<br>]/g, '');;
	contestName = contestName.replace(/[/]/g, '');

	if(!fs.existsSync(contestPath)){
		fs.mkdirSync(contestPath);
	}
	fs.writeFileSync(filePath, code);
	callback();
}

function req(requestUrl, callback){
	request({
		url  : requestUrl,
		json : true
	}, function(err, res, body){
		if(!err && res.statusCode == 200){
			callback(body.result);
		}else{
			console.log('Couldnt fetch ' + requestUrl);
			process.exit();
		}
	});
}

function getAllSubmissionsUrl(handle){
    return util.format(SUBMISSIONS_URL, handle);
}

function getSubmissionUrl(contestID, submissionID){
 return util.format(SUBMISSION_URL, contestID, submissionID);
}

function getSubmissionCode(contestID, submissionID, callback){
	var requestUrl = getSubmissionUrl(contestID, submissionID);
	request(requestUrl, function(err, res, body){
		if(!err && res.statusCode == 200){
			var $ = cheerio.load(body);
			var code = $('.program-source').text();
			callback(err, code);
		}else{
            callback(err, null);
		}
	});
}
