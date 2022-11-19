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
  const query = '*[_type == "inventory"] {_id, title, price}'

  return new Promise((resolve, reject) => {
    client
      .fetch(query)
      .then(res => {
        // console.log(res)
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
