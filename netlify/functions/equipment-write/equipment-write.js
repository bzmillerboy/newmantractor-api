const { SANITY_TOKEN_ETL, SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION } = process.env
const sanityClient = require('@sanity/client')
const client = sanityClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  token: SANITY_TOKEN_ETL,
  useCdn: false, // `false` if you want to ensure fresh data
  apiVersion: SANITY_API_VERSION
})

exports.handler = async (event, context) => {
  const doc = {
    _id: 'd07e8942-bd99-4d80-8b81-f41d2116befe-migrated',
    _type: 'inventory',
    price: 111,
    title: '2017 Morooka MST800VD new price'
  }
  const docNew = {
    _id: 'EQ0001021',
    _type: 'inventory',
    price: 999,
    title: '1989 Grove LT409',
    slug: {
      current: '1989-gove-lt409'
    }
  }
  const docUpdated = {
    price: 399,
    title: '1989 Grove LT409',
    slug: {
      current: '1989-gove-lt409'
    }
  }

  return new Promise((resolve, reject) => {
    client
      .createIfNotExists(docNew)
      .then(res => {
        return client
          .patch('EQ0001021')
          .set(docUpdated)
          .commit()
          .then(res => {
            return res
          })
      })
      .then(res => {
        console.log(`Response: ${JSON.stringify(res)}`)
        const response = {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(res)
        }
        resolve(response)
      })
      .catch(err => {
        console.log(err)
        resolve({ statusCode: err.statusCode || 500, body: err.message })
      })
  })
}
