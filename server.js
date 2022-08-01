const express = require('express'); // 기본 양식 const = 변수선언
const app = express(); // 기본 양식
app.use(express.urlencoded({extended: true}))
const MongoClient = require('mongodb').MongoClient; //npm install mongodb
app.set('view engine', 'ejs'); //ejs 사용 양식
const methodOverride = require('method-override') //PUT 메소드 사용
app.use(methodOverride('_method')) //PUT 메소드 사용
const crypto = require('crypto');
require('dotenv').config()

const createHashedPassword = (password) => {
  return crypto.createHash("sha512").update(password).digest("base64");
};

app.use('/public', express.static('public')); //static 파일(css) 보관하기 위해 public폴더를 쓸 것이다 

var db; //db를 저장할 변수 선언
MongoClient.connect(process.env.DB_URL, function(error, client){
    if (error) return console.log(error) //에러처리
    db = client.db('todoapp'); //todoapp 이라는 database에 연결

    app.listen(process.env.PORT, function(){
        console.log('listening on 8080');
    });
});

var logcheck = 0;
app.get('/', function(req, res){
    res.render('index.ejs', {logcheck : logcheck});
});

app.get('/write', function(req, res){
    res.render('write.ejs', {send : 0, logcheck : logcheck});
});

app.post('/add', function(req, res){
    res.render('write.ejs', {send : 1, logcheck : logcheck});
    db.collection('counter').findOne({Name : 'Posts_Num'}, function(error, ret){
        console.log(ret.TotalPost)
        var total_num = ret.TotalPost;
        db.collection('post').insertOne({_id : total_num + 1, title : req.body.title, date : req.body.date}, function(error, res){ // Object 자료형, req.body라고 하면 요청했던 form에 적힌 데이터 수신가능
            console.log('save complete');
            db.collection('counter').updateOne({Name : 'Posts_Num'}, {$inc : {TotalPost : 1}}, function(error, ret){
                if (error){return console.log(error)} //error 처리
            }); // 하나만 수정
        });

    });
});

app.get('/list', function(req, res){
    db.collection('post').find().toArray(function(error, ret){
        console.log(ret);
    res.render('list.ejs', {posts : ret, logcheck : logcheck}); //ejs 파일 렌더링
    });
});

app.get('/search', (req, res) => {
    var to_search = [
        {
            $search: {
                index: 'titleSearch',
                text: {
                    query: req.query.value,
                    path: ["title", "date"] // 제목, 날짜 둘 다 찾고 싶으면 ["title", "date"]
                }
            }
        },
        //{ $sort : {_id : 1} },  //id를 오름차순으로 정렬, -1 : 내림차순
        //{ $limit : 10 }, //상위 10개만 출력
        //{ $project : { title : 1, _id : 0, score : {$meta:"searchScore"}}} //원하는 것만 출력 0은 안보여주고 1은 보여주라는 뜻
    ]
    db.collection('post').aggregate(to_search).toArray((error, ret)=>{
        console.log(ret);
    res.render('search.ejs', {posts : ret, logcheck : logcheck});
    })
})

app.delete('/delete', function(req, res){
    console.log(req.body);
    req.body._id = parseInt(req.body._id); //자료형 숫자로 변환
    db.collection('post').deleteOne(req.body, function(error, ret){
        console.log('delete complete'); //터미널에 띄워짐
        res.status(200).send({ message : 'sucssess'}); //요청성공
    });
}); // DELETE 요청 처리

app.get('/edit/:id', function(req, res){
    db.collection('post').findOne({_id : parseInt(req.params.id)}, function(error, ret){
        console.log(ret);
        if (ret == null) return (res.status(404).send('404 not found'));
        res.render('edit.ejs', { data : ret, logcheck : logcheck}) // data 라는 이름으로 ejs 파일로 데이터 전송
    });
});


app.put('/edit', function(req, res){
    db.collection('post').updateOne({ _id : parseInt(req.body.id)}, { $set : { title : req.body.title, date : req.body.date}}, function(error, ret){
        console.log('edit complete');
        res.redirect('/list');

    }); //data 하나만 찾을 때
});


app.get('/detail/:id', function(req, res){
    db.collection('post').findOne({_id : parseInt(req.params.id)}, function(error, ret){
        console.log(ret);
        if (ret == null) return (res.status(404).send('404 not found'));
        res.render('detail.ejs', { data : ret}) // data 라는 이름으로 ejs 파일로 데이터 전송
    });
});

app.get((req,res)=>{
	res.status(404).send('not found');
});

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { query } = require('express');

app.use(session({secret : '비밀코드', resave : true, saveUninitialized : false}));
app.use(passport.initialize());
app.use(passport.session());

function overlap_check(req, res, next){
    //console.log(req.body.id);
    db.collection('login').findOne({ id: (req.body.id) }, function (error, ret){
        if (ret) res.render('signup.ejs', {req : 1, logcheck : logcheck});
        else next();
    });
};

app.get('/signup', function(req, res){
    res.render('signup.ejs', {req : 0, logcheck : logcheck});
});

app.post('/signup', overlap_check, function(req, res){
    res.render('login.ejs', {req : 3, logcheck : logcheck});
    db.collection('login').insertOne({ id : req.body.id, pw : createHashedPassword(req.body.pw)}, function(error, res){ // Object 자료형, req.body라고 하면 요청했던 form에 적힌 데이터 수신가능
        console.log('save complete');
        if (error){return console.log(error)};
    });
});

app.get('/login', function(req, res){
    res.render('login.ejs', {req : 0, logcheck : logcheck});
});

app.get('/loginfail', function(req, res){
    res.render('login.ejs', {req : 2, logcheck : logcheck});
});

app.post('/login', passport.authenticate('local', { //local 방식으로 회원인지 인증
    failureRedirect : '/loginfail' // 로그인실패
}), function(req, res){
    logcheck = 1;
    res.redirect('/') //회원 인증 성공 시
});

app.get('/logout', function(req, res){
    req.logout(function(error){
        if (error) {return next(error);
        }
        logcheck = 0;
        res.redirect('/');
    });
})

app.get('/mypage', logincheck, function(req, res){
    console.log(req.user);
    res.render('mypage.ejs', {user : req.user, logcheck : logcheck})
});

function logincheck(req, res, next){
    if (req.user){
        next()
    } else {
        res.render('login.ejs', {req : 1, logcheck : logcheck}); //? 뒤에 쓰면 GET method query로 서버에 전달
    }
};

passport.use(new LocalStrategy({
    usernameField: 'id', //유저가 입력한 아이디/비번 항목이 뭔지 정의 (name 속성)
    passwordField: 'pw',
    session: true, //로그인 후 세션을 저장할것인지
    passReqToCallback: false, //아이디/비번 말고 다른 정보 검증 시
  }, function (write_id, write_pw, done) {
    //console.log(입력한아이디, 입력한비번);
    db.collection('login').findOne({ id: write_id }, function (error, ret) {
      if (error) return done(error)  
      if (!ret) return done(null, false, { message: '존재하지않는 아이디요' })
      if (createHashedPassword(write_pw) == ret.pw) {
        return done(null, ret)
      } else {
        return done(null, false, { message: '비번틀렸어요' })
      }
    })
  }));

//세션을 저장시키는 코드 (로그인 성공 시 발동)
passport.serializeUser(function(user, done){
    done(null, user.id)
});

//이 세션 데이터를 가진 사람을 DB에서 찾아주세요마이페이지 접속 시 발동
passport.deserializeUser(function(id, done){
    //디비에서 위에 있는 user.id로 user를 찾은 뒤 유저 정보를 ret에 넣음
    db.collection('login').findOne({id : id}, function(error, ret){
        done(null, ret);
    });
});
