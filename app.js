var express = require('express');
var app = express();
var session = require('express-session'); 
var bodyParser = require('body-parser');

var GoogleSpreadsheet = require('google-spreadsheet');
var async = require('async');


// Get spreadsheet
// spreadsheet key is the long id in the sheets URL
// TODO: change spreadsheet 
var doc = new GoogleSpreadsheet('1nsyMpTno_uq69KgYh41d7nCqoTvJ-WVv833dG4mrHYo');
var sheet;

var itemSheet; 

var itemRows; 
var urlencodedParser = bodyParser.urlencoded({ extended: false })


/*
 * Setup the webserver. 
 * Format routing. 
 */
app.use(express.static('public'));
app.use(session({secret: 'hknsecret'})); 

/* 
 * Get / 
 */
app.get('/', function (req, res) {
    res.sendFile( __dirname + "/" + "index.html" ); 
    console.log("loaded index.html"); 
}); 


/*
 * Connect to google doc and get sheet. 
 */
async.series([
  function setAuth(step) {
    // see notes below for authentication instructions!
    var creds = require('./google-generated-creds.json');

    doc.useServiceAccountAuth(creds, step);
  },
  function getInfoAndWorksheets(step) {
    doc.getInfo(function(err, info) {
      if(err) {
        console.log(err); 
      } 
      else { 
        console.log('Loaded doc: '+info.title+' by '+info.author.email);
        sheet = info.worksheets[0];
        console.log('sheet 1: '+sheet.title+' '+sheet.rowCount+'x'+sheet.colCount);
        //itemSheet = info.worksheets[1]; 
      } 
      step();
    });
  }, 
]); 


/************************
 * ROUTES
 ************************/

app.post('/process_signin', urlencodedParser, function (req, res) {
  console.log("process signin starting ..."); 
  // Prepare output in JSON format
  // need first/last name, email, major
  response = {
    firstname:req.body.firstname, 
    lastname:req.body.lastname,
    email:req.body.email, 
    major:req.body.major
  };

  async.series([
    function trySignIn(callback) {
      var major = response.major.toString().trim(); 
      if (response.major.toString().trim() == 'other'){ 
        major = req.body.major2.toString().trim(); 
      } 
      sheet.addRow({
          'timestamp': Date().toString(), 
          'firstname': response.firstname.toString().trim(), 
          'lastname': response.lastname.toString().trim(),  
          'email': response.email.toString().trim(), 
          'major': major
      }, function(err){

        callback(err, "success"); 
          
      });

    } 
 
  ], 
  function(err, results) { 

    signinMessage = ""; 

    if(err) { 
      signinMessage = '<div class="alert alert-danger" roles="alert" id="signinMessage">Error: Student not registered.</div>'; 
    } 
    else { 
      signinMessage = '<div class="alert alert-success" roles="alert" id="signinMessage">Success! <br> ' + response.firstname.toString().trim() + ' '+response.lastname.toString().trim() + ' has been signed in.</div>'; 
    } 
    
    res.send(signinMessage); 

  }); 
  //res.end(JSON.stringify(response));
}); 



// TODO: Delete this extra stuff 

app.post('/process_registration', urlencodedParser, function (req, res) {
  console.log("process registration starting ..."); 

  // Prepare output in JSON format
  response = {
    userid:req.body.inputId, 
    username:req.body.inputName, 
    balance:req.body.inputBalance
  };

  /*
  req.session.user_id = response.userid.toString().trim(); 
  req.session.username = response.username.toString().trim(); 
  req.session.balance = response.balance.toString().trim(); 
  */
 
  async.series([

    function checkUser(callback) { 
      sheet.getRows({
        offset: 1,
      }, function( err, rows ){
        var err1 = null; 
        if (err) { 
          err1 = err; 
        } 
        else { 
          for (var i=0; i < rows.length; i++){
            if( response.userid.toString().trim() === rows[i].userid) { 
              err1 = "Error: Duplicate user id." 
            } 
          } 
        } 
        callback(err1, "success");  
      });

    }, 
    function tryRegister(callback) {
                                          
      sheet.addRow({
          'userid': response.userid.toString().trim(), 
          'username': response.username.toString().trim(),  
          'debt-credit': response.balance.toString().trim()
      }, function(err){

        callback(err, "success"); 
          
      });
    }
 
  ], 
  function(err, results) { 
    if (err) { 
      req.session.registerSuccess = false; 
      req.session.registerMessage = `<div class="alert alert-danger" role="alert">Problem creating new user.<br> `+err+`</div>`
      res.redirect("/register"); 
    } 
    else { 
      req.session.loginSuccess = false; 
      req.session.registerSuccess = true; 
      req.session.loginMessage = `<div class="alert alert-success" role="alert"><strong>Success!</strong> New user created. Please login.</div>`

      res.redirect("/"); 
    } 
    
  }); 
  //res.end(JSON.stringify(response));
}); 

var server = app.listen(1117, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Example app listening at http://%s:%s", host, port)

})
