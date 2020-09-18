const { response } = require('express');
const { user } = require('firebase-functions/lib/providers/auth');

//this checks againsg a regular expression to confirm if it's a valid email address
const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (email.match(regEx)) return true;
    else return false;
}

 // this checks to see if anything you pass through to it is empty
 const isEmpty = (string) => {
    if (string.trim() === '') return true;
    else return false;
  };

  exports.validateSignUpData = (data) => {
    let errors = {};
 
    //THE BELOW IS THE VALIDATION TO CHECK IF EVERYTHING IS FILLED IN AND THAT THE PASSWORDS MATCH
    if (isEmpty(data.email)) {
        errors.email = 'Must not be empty';
      } else if (!isEmail(data.email)) {
        errors.email = 'Must be a valid email address';
      }
   

  if (isEmpty(data.password)) errors.password = 'Must not be empty';
  if (data.password !== data.confirmPassword)
    errors.confirmPassword = 'Passwords must match';
  if (isEmpty(data.handle)) errors.handle = 'Must not be empty';


  return {
      errors,
      valid: Object.keys(errors).length === 0 ? true : false
  }
  }

  exports.validateLogInData = (data) => {
    let errors = {};

    if (isEmpty(data.email)) errors.email = 'Must not be empty';
    if (isEmpty(data.password)) errors.password = 'Must not be empty';

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
  }

  //this makes sure that the data sent to firebase at least contains empty strings and that the websiteURL has the http
  exports.reduceUserDetails = (data) => {
    let userDetails = {};

    if (!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
    if (!isEmpty(data.website.trim())) {
      if(data.website.trim().substring(0, 4) !== 'http'){
        userDetails.website = `http://${data.website.trim()}`;
      } else userDetails.website = data.website;
    }
    if (!isEmpty(data.location.trim())) userDetails.location = data.location;

    return userDetails
  };