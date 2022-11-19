const { HUBSPOT_PORTAL_ID, HUBSPOT_DEVELOPER_API_KEY } = process.env
const Hubspot = require('hubspot')
const hubspot = new Hubspot({
  apiKey: HUBSPOT_DEVELOPER_API_KEY, // HUBSPOT_API_KEY,
  checkLimit: false
})

exports.handler = async event => {
  const payload = JSON.parse(event.body)
  console.log('financing-application payload:', payload)
  const { url, contact, hutk } = payload
  const fullName = contact.name.split(' ')
  const firstName = fullName[0]
  const lastName = contact.name.substring(fullName[0].length).trim()

  const data = {
    fields: [
      {
        name: 'email',
        value: contact.email
      },
      {
        name: 'firstname',
        value: firstName
      },
      {
        name: 'lastname',
        value: lastName
      },
      {
        name: 'phone',
        value: contact.phone
      },
      {
        name: 'finance_request_url',
        value: url
      }
    ],
    context: {
      hutk: hutk, // include this parameter and set it to the hubspotutk cookie value to enable cookie tracking on your submission
      pageUri: url
    }
  }

  try {
    const apiResponse = await hubspot.forms.submit(
      HUBSPOT_PORTAL_ID,
      '3f9e682b-bb9a-40bf-9b9b-69ee97c82960',
      data
    )
    console.log(apiResponse)
    // await wait(3000)

    return {
      statusCode: 200,
      body: `Finance application sent: ${JSON.stringify(data)}`
    }
  } catch (e) {
    console.error(e)
    return {
      statusCode: e.statusCode,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`
    }
  }
}
