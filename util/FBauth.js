const { admin, db } = require('../util/admin')
const { response } = require('express');


//this function will check the token from the user and authorise the post or not

module.exports = (req, response, next) => {
    let idToken;
    if (req.headers.authorization && 
        req.headers.authorization.startsWith('Bearer ')
        ) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No Token Found');
        return response.status(403).json({ error: 'Unauthorised' });
    }

    admin
    .auth()
    .verifyIdToken(idToken)
        .then((decodedToken) => {
            req.user = decodedToken;
            return db
            .collection('users')
            .where('userId', '==', req.user.uid)
            .limit(1)
            .get();
        })
        .then((data) => {
            req.user.handle = data.docs[0].data().handle;
            req.user.imageURL = data.docs[0].data().imageURL;
            return next();
        })
        .catch(err => {
            console.error('Error while verifying token', err);
            return response.status(403).json(err);
        })
};