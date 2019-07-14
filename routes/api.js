const express = require('express');
const { check, validationResult } = require('express-validator');
const models = require('../models');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');


const router = express.Router();


// helper function: validation

const firstNameValidation = check('firstName')
    .exists({checkNull: true, checkFalsey: true})
    .withMessage("firstName is missing");

const lastNameValidation = check('lastName')
    .exists({checkNull: true, checkFalsey: true})
    .withMessage("lastName is missing");

const emailAddressValidation = check('emailAddress')
    .exists({checkNull: true, checkFalsey: true})
    .withMessage("emailAddress is missing");

const passwordValidation = check('password')
    .exists({checkNull: true, checkFalsey: true})
    .withMessage("password is missing");

const titleValidation = check('title')
    .exists({checkNull: true, checkFalsey: true})
    .withMessage("title is missing");

const descriptionValidation = check('description')
    .exists({checkNull: true, checkFalsey: true})
    .withMessage("description is missing");

const emailFormatValidation = check('emailAddress')
    .isEmail()
    .withMessage('not a valid email');


// middleware to check if provided email isn't already in database
const uniqueEmailCheck = async (req, res, next) =>{
    try{
        
        console.log("unique email check ...");
        if(req.body){
            const user = req.body;
            const email = user.emailAddress;
            let taken = null;
            await models.User.findAll().then(function(users){
                taken = users.find(user => user.emailAddress === email);
            });
            if(taken){
                res.locals.errStatus = 400;
                res.locals.errMsg = 'email already takend';
                next(new Error());
            } else {
                next();
            }
        } else {
            res.locals.errStatus = 400;
            res.locals.errMsg = 'user data required';
            next(new Error());
        }
       
    } catch(err){
        next(err);
    }
}



// authorization middleware
const authenticate = async (req, res, next) => {
    const credentials = auth(req);
    let msg = null;

    if(credentials){
        let listusers = null; 
        await models.User.findAll().then(function(list){
            listusers = list;
        });
        const currentUser = listusers.find(user => user.emailAddress === credentials.name);

        if(currentUser){
            const isAuthenticated = bcryptjs.compareSync(credentials.pass, currentUser.password)
            
            if(isAuthenticated){                
                res.locals.currentUser = currentUser;
            } else {
                msg = "authentication failed";
            }
        } else {
            msg = "no user with this email exists";
        }
    } else {
        msg = "authentication header is missing";
    }

    if(msg){
        res.locals.errStatus = 401;
        res.locals.errMsg = 'Access Denied';
        next(new Error());
    } else {
        next();
    }

}


// middleware that checks if user has access to route
const permission = async (req, res, next) => {

    try{
        const id = req.params.id;
        const currentUser = res.locals.currentUser;
        let currentCourse = null;

        await models.Course.findByPk(id).then(function(course){
            currentCourse = course;
        });

        if(currentCourse){
            if(currentCourse.userId === currentUser.id){
                next();
            } else {
                res.locals.errStatus = 403;
                res.locals.errMsg = 'this user doesnt have permission to access this route';
                next(new Error());
            }
        } else {
            res.locals.errStatus = 400;
            res.locals.errMsg = 'no such course exists';
            next(new Error());
        }
    } catch(err){
        next(err);
    }
    
    
    
}


// returns currently authenticated user
// shows properties: id, firstName, emailAddress
router.get('/users', authenticate, async (req, res, next) => {

    try {
        let listusers = null;
        await models.User.findAll({ 
            attributes: ['id', 'firstName', 'emailAddress']
        }).then(function(list){
            listusers = list;
        });
        let currentUser = listusers.find(user => user.emailAddress === res.locals.currentUser.emailAddress);
        res.json(currentUser);


    } catch(err){
        next(err);
    }

});


// creates a user, sets the Location header to "/" 
// returns no content
router.post('/users', [firstNameValidation, lastNameValidation, emailAddressValidation, passwordValidation, uniqueEmailCheck], 
    async (req, res, next) => {

    try{ 
        const errors = validationResult(req).errors;
        if(errors.length > 0){
            const errMsgs = errors.map(err => err.msg);
            res.locals.errStatus = 400;
            res.locals.errMsg = errMsgs;
            next(new Error());
        } else {
            if(req.body){
                const user = req.body;
                user.password = bcryptjs.hashSync(user.password);
                await models.User.create(user);
                res.location('/');
                res.status(201).end();
            } else {
                res.locals.errStatus = 400;
                res.locals.errMsg = "user data required";
                next(new Error());
            }
        }
        
        
    } catch(err){
        next(err);
    }
    
});



// returns a list of courses 
// including the user that owns each course
// shows properties: id, userId, title, description, estimatedTime, materialsNeeded
router.get('/courses', async (req, res, next) => {
    let listcourses;
    try{
        await models.Course.findAll({
            attributes: [
                "id",
                "userId",
                "title",
                "description",
                "estimatedTime",
                "materialsNeeded"
            ]
        }).then(function(courses){
            listcourses = courses;
        });
        res.json(listcourses);
        

    } catch(err){
        next(err);
    }
});

// creates a course, sets the Location header to the URI for the course
// returns no content
router.post('/courses', [authenticate, titleValidation, descriptionValidation], 
    async (req, res, next) => {
    try{

        const errors = validationResult(req);

        if(!errors.isEmpty){
            const errMsgs = errors.array().map(err => err.msg);
            res.locals.errStatus = 400;
            res.locals.errMsg = errMsgs;
            next(new Error());
        } else {
            const courseData = req.body;
            let id = null;
            await models.Course.create(courseData).then(function(course){
                id = course.id;
            });
            res.location('/api/courses/' + id);
            res.status(201).end();
        }
        
    } catch(err){
        next(err);
    }
});


// returns the course for the provided course ID
router.get('/courses/:id', async (req, res, next) => {

    try{
        const idNr = req.params.id;
        await models.Course.findOne({
            where: {id: idNr},
            attributes: [
                "id",
                "userId",
                "title",
                "description",
                "estimatedTime",
                "materialsNeeded"
            ]
        }).then(function(course){
            if(course){
                res.json(course);
            } else {
                res.locals.errStatus = 400;
                res.locals.errMsg = "No such course exists";
                next(new Error());
            }
        });
    } catch (err){
        next(err);
    }
    
});



// updates a course
// returns no content
// can only be used by user that owns route
router.put('/courses/:id', [authenticate, permission], async (req, res, next) => {
    
    try {
        const id = req.params.id;
        const update = req.body;
        if(update){
            await models.Course.findByPk(id).then(function(course){
                if(course){
                    return course.update(update);
                } else {
                    res.locals.errStatus = 400;
                    res.locals.errMsg = "No such course exists";
                    next(new Error());
                }
            });        
            res.status(204).end();
        } else {
            res.locals.errStatus = 400;
            res.locals.errMsg = "update data is missing";
            next(new Error());
        }
        
    } catch(err){
        next(err);
    }
    
});


// deletes a course 
// returns no content
router.delete('/courses/:id', [authenticate, permission], async  (req, res, next) => {
    try {
        const id = req.params.id;
        await models.Course.findByPk(id).then(function(course){
            if(course){
                return course.destroy()
            } else {
                res.locals.errStatus = 400;
                res.locals.errMsg = "No such course exists";
                next(new Error());
            }
        });
        res.status(204).end();

        
    } catch(err){
        next(err);
    }
});



module.exports = router;   