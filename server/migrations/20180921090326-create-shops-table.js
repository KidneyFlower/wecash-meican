'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.createTable(
      'shops',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        type: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        dishes_count: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        rate: {
          type: Sequelize.DECIMAL(2, 1),
          allowNull: false
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: Sequelize.DATE,
        updated_at: Sequelize.DATE
      }
    )
  },
  down: queryInterface => {
    queryInterface.dropTable('shops')
  }
}
