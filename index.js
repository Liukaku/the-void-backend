const functions = require('firebase-functions');

const app = require('express')();
const { response } = require('express');

const { getAllScreams, voidScreaming, getScream, commentOnScream, likeScream, unlikeScream, deleteScream } = require('./handlers/screams');
const { signUp, login, imageUpload, addUserDetails, getAuthenticatedUser, markNotificationsRead, getUserDetails } = require('./handlers/users');

const { db } = require('./util/admin');

var ignore = "r0224127832";

const FBauth = require('./util/FBauth');


//this returns all the posts 
//getAllScreams is within the handlers 
app.get('/screams', getAllScreams);

//this creats a new post
app.post('/scream', FBauth, voidScreaming);

 //Signup route
 app.post('/signup', signUp);

 //login route
 app.post('/login', login);

 //image upload
 app.post('/user/image', FBauth, imageUpload);

 //updates user profile
 app.post('/user', FBauth, addUserDetails);

 //gets the current user details
 app.get('/user', FBauth, getAuthenticatedUser);

 app.get('/user/:handle', getUserDetails);

 //send an array of notification DB Doc IDs and it will update them to mark them as read
 app.post('/notifications', FBauth, markNotificationsRead);

 //this gets a list of the screams for the screamId that you give it
 //worth noting for future me that it HAS to be lowercase 'd', things are case sensitive. duh.
 app.get('/scream/:screamId', getScream);

 app.delete('/scream/:screamId', FBauth, deleteScream)
 app.get('/scream/:screamId/like', FBauth, likeScream);
 app.get('/scream/:screamId/unlike', FBauth, unlikeScream);
 app.post('/scream/:screamId/comment', FBauth, commentOnScream);




 exports.api = functions.region('europe-west1').https.onRequest(app);

 exports.createNotificationOnLike = functions.region('europe-west1').firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        db.doc(`/screams/${snapshot.data().screamId}`).get()
            .then((doc) => {
                if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle ) {
                    console.log('like notification successful');
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'like',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .then(() => {
                return;
            })
            .catch((err) => {
                console.error(err);
                return;
            })
    })

exports.deleteNotificationOnUnlike = functions.region('europe-west1').firestore.document('likes/{id}')
    .onDelete((snapshot) => {
        db.doc(`/notifications/${snapshot.id}`).delete()
        .then(() => {
            return
        })
        .catch((err) => {
           console.error(err);
           return 
        })
    })

exports.createNotificationOnComment = functions.region('europe-west1').firestore.document('comments/{id}')
.onCreate((snapshot) => {
    db.doc(`/screams/${snapshot.data().screamId}`).get()
        .then((doc) => {
            if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
                console.log('comment notification successful');
                return db.doc(`/notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient: doc.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'comment',
                    read: false,
                    screamId: doc.id
                });
            }
        })
        .then(() => {
            return;
        })
        .catch((err) => {
            console.error(err);
            return;
        })
})

//this updates the user's image URL within the comments that they have made should they update their profile image
exports.onUserImagechange = functions.region('europe-west1').firestore.document('/users/{userId}')
    .onUpdate((change) => {
        console.log(change.before.data());
        console.log(change.after.data());
        if (change.before.data().imageURL !== change.after.data().imageURL) {
            console.log('User image has been updated');
            const batch = db.batch();
            return db.collection('screams').where('userHandle', '==', change.before.data().handle).get()
                .then((data) => {
                    data.forEach(doc => {
                        const scream = db.doc(`/screams/${doc.id}`);
                        batch.update(scream, { userImage: change.after.data().imageURL });
                    })
                    return batch.commit();
                })
        } else return true
    })

//if someone deletes a post then this will delete all of the like and comments associated to that post
exports.onScreamDeletion = functions.region('europe-west1').firestore.document('/screams/{screamId}')
    .onDelete((snapshot, context) => {
        const screamId = context.params.screamId;
        const batch = db.batch();

        return db.collection('comments').where('screamId', '==', screamId).get()
        .then((data) => {
            data.forEach(doc => {
                batch.delete(db.doc(`/comments/${doc.id}`));
            })
            return db.collection('likes').where('screamId', '==', screamId).get()
        })
            .then((data) => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/likes/${doc.id}`));
                })
                return db.collection('notifications').where('screamId', '==', screamId).get()
            })
                .then((data) => {
                    data.forEach(doc => {
                        batch.delete(db.doc(`/notifications/${doc.id}`));
                    })
                    return batch.commit();
        })
        .catch(err => {
            console.error(err);
        })
    })