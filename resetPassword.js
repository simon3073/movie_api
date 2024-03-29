const sendEmail = require('./sendMail')
const crypto = require('crypto')
const bcrypt = require('bcrypt')

/** Express router providing user related routes
 * @module models.js
 * @requires Models
 */
const Models = require('./models')
const User = Models.User
const Token = Models.Token

const sendResetEmail = async (user) => {
  try {
    await User.findOneAndUpdate(
      { Username: user.Username },
      { $unset: { ResetToken: '' } }
    )
    const resetToken = crypto.randomBytes(32).toString('hex')
    const hash = bcrypt.hashSync(resetToken, 10)
    const resetTokenObj = await new Token({
      userId: user._id,
      token: hash,
      expiryTime: Date.now() + 600000,
    })

    await User.findOneAndUpdate(
      { Username: user.Username },
      {
        $set: {
          ResetToken: resetTokenObj,
        },
      }
    )
    const link = `${process.env.CLIENT_URL}passwordreset?token=${hash}&id=${user._id}`
    sendEmail(
      user.Email,
      'Password Reset Request',
      { name: user.Username, link: link },
      './template/requestResetPassword.handlebars'
    )
  } catch (error) {
    console.log(error)
  }
}

// Exported from and imported to the main "index.js" file to catch all /login requests
module.exports = (router) => {
  router.post('/resetpassword', async (req, res) => {
    try {
      let user = await User.findOne({ Username: req.body.searchterm })
      if (!user) {
        user = await User.findOne({ Email: req.body.searchterm })
        if (!user) {
          res
            .status(401)
            .send('-' + req.body.searchterm + 'User could not be found!')
        } else {
          sendResetEmail(user)
          res.status(200).send(`User found`)
        }
      } else {
        sendResetEmail(user)
        res.status(200).send(`User found`)
      }
    } catch (error) {
      console.error(error)
      res.status(500).send(`Error: ${error}`)
    }
  })

  router.post('/validatetoken', async (req, res) => {
    User.findOne({
      'ResetToken.userId': req.body.userid,
      'ResetToken.token': req.body.token,
      'ResetToken.expiryTime': { $gt: Date.now() },
    }).then((user) => {
      if (!user) {
        return res
          .status(401)
          .json({ message: 'Password reset token is invalid or has expired.' })
      } else {
        return res.status(200).json(user)
      }
    })
  })

  router.put('/updatepassword', async (req, res) => {
    const hashedPassword = User.hashPassword(req.body.password)
    User.findOneAndUpdate(
      { Username: req.body.username },
      {
        $set: {
          Password: hashedPassword,
        },
      },
      { new: true },
      (err, updatedUser) => {
        if (updatedUser === null) {
          res.status(500).json({ message: 'Password could not be reset.' })
        } else {
          res.status(201).json({ message: 'Password has been reset.' })
        }
      }
    )
  })
}
