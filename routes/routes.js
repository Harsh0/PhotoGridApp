module.exports = function(express,app,formidable,fs,os,gm,knoxClient,mongoose,io){
  
  var Socket;
  io.on('connection',function(socket){
    Socket = socket;
  });
  var singleImage =  new mongoose.Schema({
    filename:String,
    votes:Number
  });
  var singleImageModel = mongoose.model('singleImage',singleImage);
  
  var router = express.Router();
  
  router.get('/',function(req,res,next){
    res.render('index',{host:app.get('host')});
  }) 
  
  router.post('/upload',function(req,res,next){
    //File Upload
    function generateFilename(filename){
      var ext_regex = /(?:\.([^.]+))?$/;
      var ext = ext_regex.exec(filename)[1];
      var date = new Date().getTime();
      var charBank = "abcdefghijklmnopqrstuvwxyz";
      var fstring = '';
      for(var i=0;i<15;i++){
        fstring+=charBank[parseInt(Math.random()*26)];
      }
      return (fstring+date+'.'+ext);
    }
    
    var tmpFile,nFile,fname;
    var newForm = formidable.IncomingForm();
    newForm.keepExtensions = true;
    newForm.parse(req,function(err,fields,files){
      tmpFile = files.upload.path;
      fname = generateFilename(files.upload.name);
      nFile = os.tmpDir()+'/'+fname;
      res.writeHead(200,{
        'Content-type':'text/plain'
      });
      res.end();
    })
    newForm.on('end',function(){
      fs.rename(tmpFile,nFile,function(){
        //resize the image and upload this file into the s3 bucket
        gm(nFile).resize(300).write(nFile,function(){
          //upload to s3 bucket
          fs.readFile(nFile,function(err,buf){
            
            var req = knoxClient.putBuffer(buf,'/'+fname,{
              'Content-type':'image/jpg'
            },function(err,res){
            	if(res.statusCode ==200){
                //This means file is inside s3 bucket
                console.log('inside s3');
                
                var newImage = new singleImageModel({
                  filename:fname,
                  votes:0
                }).save();
                Socket.emit('status',{
                  msg:'Saved !!',
                  delay:3000
                })
                Socket.emit('doUpdate',{});
                fs.unlink(nFile,function(){
                  console.log('local file deleted');
                })
              }
              else{
              	console.log(res.statusCode);
              }	
            });

          });
          //read file ends
        });
        //graphic magic ends
      });
      //file rename end
    });
    //newForm end
  }); 
  //route end
  
  app.use('/',router);
}