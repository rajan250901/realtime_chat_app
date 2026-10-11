const userModels = require('../models/userModels');
const userController = async (req, res) =>{
    const user = req.user;
    try{
        return res.status(200).send({
            success : true,
            message : "user find successfully",
            user: user
        })
    }catch(error){
        return res.status(500).send({
            succes: false,
            message : "error in user controller API",
            error : error
        })
    }
}

const searchUsersController = async (req, res) => {
  try {
    const search = req.query.search?.trim();

    console.log("Search text:", search);
    console.log("Logged-in user ID:", req.user.id);

    if (!search) {
      return res.status(400).json({
        success: false,
        message: "Please provide search text",
      });
    }

    const users = await userModels.searchUsers(
      search,
      req.user.id
    );

    console.log("Matched users:", users);

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Search users error:", error);

    return res.status(500).json({
      success: false,
      message: "Error searching users",
    });
  }
};

// const userModel = require("../models/userModel");


const getCurrentUser = async (req, res) => {

    try {

        const user =
            await userModels.getUserById(
                req.user.id
            );


        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }


        return res.status(200).json({

            success: true,

            message:
                "User found successfully",

            user

        });


    } catch (error) {

        console.error(
            "Get current user error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Error getting current user"

        });

    }

};

module.exports = { getCurrentUser, userController, searchUsersController }