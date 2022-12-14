const { HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID } = process.env
const Hubspot = require('hubspot')
const hubspot = new Hubspot({
  apiKey: HUBSPOT_API_KEY,
  checkLimit: false,
})

exports.handler = async (event) => {
  const payload = JSON.parse(event.body)
  const { email, formId } = payload
  console.log(payload)
  const data = {
    fields: [
      {
        name: 'email',
        value: email,
      },
    ],
  }

  try {
    await hubspot.forms.submit(HUBSPOT_PORTAL_ID, formId, data)
    return {
      statusCode: 200,
      body: `Subscription request sent: ${JSON.stringify(data)}`,
    }
  } catch (e) {
    console.error(e)
    return {
      statusCode: e.statusCode,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    }
  }
}
