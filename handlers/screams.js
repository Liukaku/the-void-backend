const { db, admin } = require('../util/admin');
const { response } = require('express');

exports.getAllScreams = (req, response) => {
    db
    .collection('screams')
    .orderBy('createdAt', 'desc')
    .get()
    .then(data => {
        let screams = [];
        data.forEach(doc => {
            screams.push({
                screamId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt,
                commentCount: doc.data().commentCount,
                likeCount: doc.data().likeCount,
                userImage: doc.data().userImage
            });
        });
        return response.json(screams);
    })
    .catch(err => console.log(err));
}

exports.voidScreaming = (req, response) => {
    //build the object to create the doc in firebase
    const newScream = {
        body: req.body.body,
        userHandle: req.user.handle,
        userImage: req.user.imageURL,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };

    admin.firestore()
    .collection('screams')
    .add(newScream)
    .then((doc) => {
        const resScream = newScream;
        resScream.screamId = doc.id;
        response.json(resScream);
    })
    .catch(err => {
        response.status(500).json({ error: 'something went wrong'});
        console.log(err);
    })
 }
 

//returns the scream comments for the scream/post ID that you give it
//it seemed like a good name at the time, idk
exports.getScream = (req, response) => {
    let screamData = {};
    db.doc(`/screams/${req.params.screamId}`)
    .get()
    .then((doc) => {
        if(!doc.exists){
            console.error(doc.exists);
            console.error(req.params.screamId);
            return response.status(404).json({ error: 'scream not found'})
        } 
        screamData = doc.data();
        screamData.screamId = doc.id;

        return db
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('screamId', '==', req.params.screamId)
        .get();

    })
    .then((data) => {
        screamData.comments = [];
        data.forEach((doc) => {
            screamData.comments.push(doc.data())
        });
        return response.json(screamData);
    })
    .catch(err => {
        console.error(err);
        response.status(500).json({ error: err.code });
    })
}

exports.commentOnScream = (req, response) => {
    if(req.body.body.trim() === '') return response.status(400).json({ comment: 'Must not be empty'});

    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        screamId: req.params.screamId,
        userHandle: req.user.handle,
        userImage: req.user.imageURL
    };


    db.doc(`/screams/${req.params.screamId}`).get()
    .then((doc) =>{
        if (!doc.exists) {
            return response.status(400).json({ error: 'Scream not found'});
        }
        return doc.ref.update({ commentCount: doc.data().commentCount + 1});
    })
    .then(() => {
        return db.collection('comments').add(newComment);
    })
    .then(() => {
        response.json(newComment);            
    })
    .catch((err) => {
        console.error(err);
        response.status(500).json({ error: 'Something went wrong' });
    });
};

//this likes a scream
exports.likeScream = (req, response) => {
    //needs to check if the posts exists and if the post has already been liked by the user
    const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
        .where('screamId', '==', req.params.screamId).limit(1); //.limit will always return an array but this will retun an array with a sigle entry

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData;

    screamDocument.get()
        .then((doc) => {
            if(doc.exists){
                screamData = doc.data();
                screamData.screamId = doc.id;
                return likeDocument.get();
            } else {
                return response.status(404).json({ error: 'Scream not found'});
            }
        })
        .then((data) => {
            //this if block checks to see if this person has already liked the post, if it is empty then it will like the post, else it will return an error
            if(data.empty){
                return db.collection('likes').add({
                    screamId: req.params.screamId,
                    userHandle: req.user.handle,
                    createdAt: new Date().toISOString()
                })
                .then(() => {
                    screamData.likeCount++
                    return screamDocument.update({ likeCount: screamData.likeCount })
                })
                .then(() => {
                    return response.json(screamData);
                })
            } else {
                return response.status(400).json({ error: 'Scream already liked'})
            }
        })
        .catch(err => {
            console.error(err);
            response.status(500).json({ error: err.code });
        });
};

exports.unlikeScream = (req, response) => {
        //needs to check if the posts exists and if the post has already been liked by the user
        const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
        .where('screamId', '==', req.params.screamId).limit(1); //.limit will always return an array but this will retun an array with a sigle entry

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData;

    screamDocument.get()
        .then((doc) => {
            if(doc.exists){
                screamData = doc.data();
                screamData.screamId = doc.id;
                return likeDocument.get();
            } else {
                return response.status(404).json({ error: 'Scream not found'});
            }
        })
        .then((data) => {
            //this if block checks to see if this person has already unliked the post, if it is empty then it will unlike the post, else it will return an error
            //yes this is very copy and pasted from above
            if(data.empty){
                return response.status(400).json({ error: 'Scream not liked'})
                
            } else {
                return db.doc(`/likes/${data.docs[0].id}`).delete()
                    .then(() => {
                        screamData.likeCount--;
                        return screamDocument.update({ likeCount: screamData.likeCount });
                    })
                    .then(() => {
                        response.json(screamData);
                    })
            }
        })
        .catch(err => {
            console.error(err);
            response.status(500).json({ error: err.code });
        });
};

//deletes a scream
exports.deleteScream = (req, response) => {
    const document = db.doc(`/screams/${req.params.screamId}`);

    document.get()
        .then((doc) => {
            if(!doc.exists){
                return response.status(404).json({ error: 'Scream not found' })
            }
            if(doc.data().userHandle !== req.user.handle){
                return response.status(403).json({ error: 'Unauthorised' })
            } else {
                return document.delete();
            }
        })
        .then(() => {
            response.json({ message: 'Scream deleted successfully '})
        })
        .catch(err => {
            console.error(err);
            return response.status(500).json({ error: err.code })
        })
}