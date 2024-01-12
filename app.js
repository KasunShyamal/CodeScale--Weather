const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());


mongoose.connect("mongodb+srv://kshyamal:k8XluKTPtLOLiCIR@cluster0.tohqfwh.mongodb.net/Weather?retryWrites=true&w=majority")
.then(()=>app.listen(5000))
.then(()=>console.log(console.log('Server is running on http://localhost:5000')))
.then(()=>console.log("DB Connected"))
.catch((err)=>console.log(err)); 

const userSchema = new mongoose.Schema({
    email : String,
    location : String,
    weatherData : [{
        date : {type: Date, default: Date.now},
        weather : String,
        temperature: Number,
        humididty: Number,
        wind : Number,
    }],

});

const User = mongoose.model('user', userSchema);

const weatherKey  = '0a2c6b2ae592fa6177997cdc0f16daf4';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    user: 'smtp.gmail.com',
    auth: {
      type: 'login',
      user: process.env.User, 
      pass: process.env.App_Pw,
    },
  });

//Add User
app.post('/users', async(req, res) => {

    const { email, location } = req.body;
    let existingUser;
    
    try {
        existingUser = await User.findOne({ email });
    } catch (error) {
        console.log(error);
    }

    if(existingUser){
        res.status(400).json({ error: 'User Already Existing'});
    }
    else{
        try {

            const user = new User({ email, location});
            await user.save();
            res.status(200).json({ message: 'User created Successfully'});
    
        } catch (error) {
            res.status(400).json({ error: 'Failed'});
        }
    }
    
});


//Update User Location
app.put('/users/:id/location', async (req, res) => {
    try {
        
        const { id } = req.params;
        const { location } = req.body;
        await User.findByIdAndUpdate(id, { location });
        res.status(200).json({ message: 'Location Updated Successfully'});
    } catch (error) {
        res.status(400).json({ error: 'Update Failed'});
    }
});


//Get user by Id
app.get('/users/:id/weather/:date', async (req, res) => {
    try {
      const { id, date } = req.params;
      const user = await User.findById(id);
      const weatherData = user.weatherData.filter((data) => {
        const dataDate = new Date(data.date).toLocaleDateString();
        return dataDate === date;
      });
      //res.json(weatherData);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

//Scheduling hours
cron.schedule('1 * * * * *', async () => {
    try {
        const users = await User.find();
        //console.log(users, "sxjnwjn");
        for(const user of users){
            const weatherdata = await getWeatherData(user.location);
            user.weatherData.push(weatherdata);
            //console.log(weatherdata);
            await user.save();
            await weatherReport(user.email, weatherdata);
        }
    } catch (error) {
        console.error('Failed to send report', error);
    }
});

//calling to open weather map Api
async function getWeatherData(location) {
    const URL = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${weatherKey}`;
    const response = await axios.get(URL);
    //console.log("response",response.data.weather[0].description);

    return {
        date: new Date(),
        weather: response.data.weather[0].description,
        temperature: response.data.main.temp,
        humididty: response.data.main.humidity,
        wind: response.data.wind.speed
    };
}


async function weatherReport(email, weatherData){
    const mailOptions = {
        from: process.env.User,
        to: email,
        subject: 'Hourley Weather Report',
        text: `Weather Report for your location : \n${JSON.stringify(weatherData, null, 2)}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Weather Report Sent Successfully to ${email}`);
    } catch (error) {
        console.error('Failed to send email', error); 
    }
};

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went Wrong');
});


