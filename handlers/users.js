const { admin, db } = require('../util/admin');

const config = require('../util/config');

const { response } = require('express');

const firebase = require('firebase');

firebase.initializeApp(config);

const { validateSignUpData, validateLogInData, reduceUserDetails } = require('../util/validators');
const { user } = require('firebase-functions/lib/providers/auth');

exports.signUp = (req, response) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    };

    const { valid, errors } = validateSignUpData(newUser);

    if(!valid) return response.status(400).json(errors);

    const noImage = 'no-image.webp';
    
 
    //we will need this later so declared now
     let token, userId;
 
    //TODO: validate user doesn't already exist
    db.doc(`/users/${newUser.handle}`).get()
     .then(doc => {
         if(doc.exists){
             return response.status(400).json({handle: 'This handle is already taken'});
         } else {
            return firebase
             .auth()
             .createUserWithEmailAndPassword(newUser.email, newUser.password)
         }
     })
     .then((data) => {
         //this asigns the userId variable we decalred above so that it can be used when created the user doc below
         userId = data.user.uid;
         return data.user.getIdToken();
     })
     .then((idToken) => {
         token = idToken;
         const userCredentials = {
             handle: newUser.handle,
             email: newUser.email,
             createdAt: new Date().toISOString(),
             imageURL: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImage}?alt=media`,
             userId
         };
         //this creates the user account doc
         return db.doc(`/users/${newUser.handle}`).set(userCredentials);
         //commented out rather than deleted in case this all breaks and i need to revert back
         //return response.status(201).json({ token });
     })
     .then(() => {
         return response.status(201).json({ token });
     })
     .catch(err => {
         //do some basic error handling, check if the email exists, throw the error back for everything else for debugging
         console.log(err);
         if(err.code === 'auth/email-already-in-use'){
             return response.status(400).json({ email: 'Email is already in use' });
         } else {
             return response.status(500).json({ general: 'Somthing went wrong, please try again' });
         }
     })
  }

  exports.login = (req,response) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    const { valid, errors } = validateLogInData(user);

    if(!valid) return response.status(400).json(errors);

    if (Object.keys(errors).length > 0 ) return response.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
       .then(data => {
           return data.user.getIdToken();
       })
       .then(token => {
           return response.json({token});
       })
       .catch(err => {
           console.log(err);

           //there is also the err.code of auth/user-not-found that can be set up but security and all that so might be best to not use it
           if(err.code === "auth/user-not-found") {
            return response.status(403).json({ general: 'Incorrect handle or password, please try again' })
        }
           if(err.code === "auth/wrong-password") {
               return response.status(403).json({ general: 'Incorrect handle or password, please try again' })
           }
           return response.status(500).json({error: err.code});
       })
}

//add user details
exports.addUserDetails = (req, response) => {
    let userDetails = reduceUserDetails(req.body);

    db.doc(`/users/${req.user.handle}`)
     .update(userDetails)
     .then(() => {
         return response.json({ message: 'Details added successfully'});
     })
     .catch((err) => {
         console.error(err);
         return response.status(500).json({ error: err.code});
     })
}

//get our own user details 
exports.getAuthenticatedUser = (req, response) => {
    let userData = {};
    db.doc(`/users/${req.user.handle}`)
        .get()
        .then((doc) => {
            if(doc.exists){
                userData.credentials = doc.data();
                return db.collection('likes').where('userHandle', '==', req.user.handle).get();
            }
        })
        .then(data => {
            userData.likes = [];
            data.forEach(doc => {
                userData.likes.push(doc.data());
                
            }); 
            return db.collection('notifications').where('recipient', '==', req.user.handle)
            .orderBy('createdAt', 'desc').limit(10).get();
        }) 
        .then(data => {
            userData.notifications = [];
            data.forEach(doc => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    screamId: doc.data().screamId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationId: doc.id
                })
            })
            return response.json(userData);
        })
        .catch (err => {
            console.error(err);
            return response.status(500).json({ error: err.code })
        })
}

//gets any users details
exports.getUserDetails = (req, response) => {
    let userData = {};
    db.doc(`/users/${req.params.handle}`).get()
        .then((doc) => {
            if(doc.exists){
                userData.user = doc.data();
                return db.collection('screams').where('userHandle', '==', req.params.handle)
                    .orderBy('createdAt', 'desc')
                    .get();
            } else {
                return response.status(404).json({ error: 'User not found'})
            }
        })
        .then(data => {
            userData.screams = [];
            data.forEach(doc => {
                userData.screams.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    screamId: doc.id
                })
            });
            return response.json(userData)
        })
        .catch(err => {
            console.error(err);
            return response.status(500).json({ error: err.code })
        })
}

//you send an array of notification IDs to this and it updates them within the DB to mark them as read
exports.markNotificationsRead = (req, response) => {
    let batch = db.batch();

    req.body.forEach(notificationId =>{
        const notification = db.doc(`notifications/${notificationId}`);
        batch.update(notification, { read: true});
    });
    batch.commit()
        .then(() => {
            return response.json({ message: 'Notifications marked as read' })
        })
    .catch(err => {
        console.error(err);
        return response.status(500).json({ error: err.code })
    })
}

//busboy is an npm package for handling uploads
//uploads user profile picture
exports.imageUpload = (req, response) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = new BusBoy({ headers: req.headers });

    let imageFileName;
    let imageToBeUploaded = {};

    //even though they aren't all going to be used, for busboy you have to enter all the parameters like that
    //e.g. if you removed 'encoding' then it will still look for encoding but it will use the property of 'mimetype'
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {

        //using a split to match the start of the mime type so that image file types can be uploaded without having to create a case for each of them
        if (mimetype.split('/')[0] !== 'image') {
            return response.status(400).json({ error: 'Only images can be uploaded' });
        }

        //this splits the uploaded file's name then obtains whatever comes after the last dot and uses that to get the file extension
        const imageExt = filename.split('.')[filename.split('.').length - 1];

        //this generates a random number and adds the file extension from above
        imageFileName = `${Math.round(Math.random() * 10000000)}.${imageExt}`;
        const filePath = path.join(os.tmpdir(), imageFileName);

        imageToBeUploaded = {filePath, mimetype}

        file.pipe(fs.createWriteStream(filePath));
    });
    
    busboy.on('finish', () => {
        admin.storage().bucket().upload(imageToBeUploaded.filePath, {
            resumable: false,
            metadata: {
                metadata:{
                    contentType: imageToBeUploaded.mimetype
                }
            }
        })
        .then(() => {
            const imageURL = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
            return db.doc(`/users/${req.user.handle}`).update({ imageURL });
        })
        .then(() => {
            return response.json({ message: 'image uploaded successfully'})
        })
        .catch(err => {
            console.error(err);
            return response.status(500).json({error: err.code});
        });
    });
    busboy.end(req.rawBody);
};