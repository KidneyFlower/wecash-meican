const Joi = require('joi')
const Boom = require('boom')
const axios = require('axios')
const config = require('../config')
const sequelize = require('sequelize')
const { paginationDefine } = require('../utils/router-helper')
const models = require('../models')

const GROUP_NAME = 'comments'

module.exports = [
  {
    method: 'GET',
    path: `/${GROUP_NAME}`,
    config: {
      tags: ['api', GROUP_NAME],
      description: '获取评价列表',
      notes: '获取评价列表',
      auth: false,
      validate: {
        query: {
          ...paginationDefine,
          dishId: Joi.number().integer().min(1).required().description('菜品ID')
        }
      }
    },
    handler: async (req, h) => {
      const { currentPage, pageSize, dishId } = req.query
      const { rows: results, count: total } = await models.comments.findAndCountAll({
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        where: {
          dish_id: dishId
        },
        order: [
          ['id', 'DESC']
        ]
      })
      req.total = total
      return results
    }
  },
  {
    method: 'POST',
    path: `/${GROUP_NAME}`,
    config: {
      tags: ['api', GROUP_NAME],
      description: '新增评价',
      notes: '新增评价',
      auth: false,
      validate: {
        payload: {
          userId: Joi.number().integer().min(1).required().description('userID'),
          userName: Joi.string().required().description('userName'),
          userAvatar: Joi.string().required().description('userAvatar'),
          shopId: Joi.number().integer().min(1).description('shopId'),
          dishId: Joi.number().integer().min(1).description('dishId'),
          comment: Joi.string().required().description('comment'),
          rate: Joi.number().min(0).max(5).required().description('rate')
        }
      }
    },
    handler: async (req, h) => {
      try {
        const { userId, userName, userAvatar, shopId, dishId, comment, rate } = req.payload
        // 获取 accessToken
        const accessTokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
          params: {
            grant_type: 'client_credential',
            APPID: config.secret.appId,
            secret: config.secret.appSecret
          }
        })
        const accessToken = accessTokenRes.data.access_token
        // 判断内容是否含有敏感词
        const msgCheckRes = await axios.post('https://api.weixin.qq.com/wxa/msg_sec_check', {
          content: comment
        }, {
          params: {
            access_token: accessToken
          }
        })
        const checkCode = msgCheckRes.data.errcode
        if (checkCode === 87014) {
          return Boom.badRequest('内容含有敏感词')
        }
        // 判断菜品是否存在
        const dish = await models.dishes.findOne({
          where: {
            id: dishId
          }
        })
        if (!dish) {
          throw Boom.badRequest('菜品不存在')
        }
        // 将本次评价写入
        await models.comments.create({
          user_id: userId,
          user_name: userName,
          user_avatar: userAvatar,
          dish_id: dishId,
          comment,
          rate
        })
        // 获取菜品的平均分值
        const dishAvgRate = await models.comments.findAll({
          where: {
            dish_id: dishId
          },
          attributes: [[sequelize.fn('AVG', sequelize.col('rate')), 'avgRate']]
        })
        // 更新菜品分值
        await dish.update({
          rate: dishAvgRate[0].dataValues.avgRate > 0 ? dishAvgRate[0].dataValues.avgRate : rate
        })
        // 获取商家的平均分值
        const shopAvgRate = await models.dishes.findAll({
          where: {
            shop_id: shopId,
            rate: {
              [models.sequelize.Op.gt]: 0
            }
          },
          attributes: [[sequelize.fn('AVG', sequelize.col('rate')), 'avgRate']]
        })
        // 更新商家分值
        await models.shops.update({
          rate: shopAvgRate[0].dataValues.avgRate > 0 ? shopAvgRate[0].dataValues.avgRate : rate
        }, {
          where: {
            id: shopId
          }
        })
        return {
          statusCode: 200,
          error: null,
          message: '操作成功!'
        }
      } catch (err) {
        console.log(err)
        throw Boom.badImplementation('评价失败，请重试')
      }
    }
  }
]
