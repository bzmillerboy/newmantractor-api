const { HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID } = process.env
const rentalTerritories = require('../data/territories.json')
const Hubspot = require('hubspot')
const hubspot = new Hubspot({
  apiKey: HUBSPOT_API_KEY,
  checkLimit: false,
})

exports.handler = async (event) => {
  const payload = JSON.parse(event.body)
  const { url, contact } = payload
  const fullName = contact.name.split(' ')
  const firstName = fullName[0]
  const lastName = contact.name.substring(fullName[0].length).trim()

  const defaultSalesContact = {
    contactName: 'Unassigned',
    contactEmail: 'marketing@newmantractor.com',
    hubSpotOwnerId: 91564072,
  }
  const salesContact =
    rentalTerritories.find((c) => c.countyName === contact.county) || defaultSalesContact

  // console.log(salesContact)

  const data = {
    fields: [
      {
        name: 'email',
        value: contact.email,
      },
      {
        name: 'firstname',
        value: firstName,
      },
      {
        name: 'lastname',
        value: lastName,
      },
      {
        name: 'phone',
        value: contact.phone,
      },
      {
        name: 'county',
        value: contact.county,
      },
      {
        name: 'demo_request_url',
        value: url,
      },
      {
        name: 'sales_owner_name',
        value: salesContact.contactName,
      },
      {
        name: 'sales_owner_email',
        value: salesContact.contactEmail,
      },
    ],
  }

  const contactOwnerData = {
    properties: [
      {
        property: 'hubspot_owner_id',
        value: salesContact.hubSpotOwnerId,
      },
    ],
  }

  // const wait = (timeToDelay) => new Promise((resolve) => setTimeout(resolve, timeToDelay))

  try {
    await hubspot.forms.submit(HUBSPOT_PORTAL_ID, '15269a77-1b0e-4bb9-a3e4-12daacfcf751', data)
    await hubspot.contacts.createOrUpdate(contact.email, contactOwnerData)
    // await wait(3000)

    return {
      statusCode: 200,
      body: `Demo request sent: ${JSON.stringify(data)}`,
    }
  } catch (e) {
    console.error(e)
    return {
      statusCode: e.statusCode,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    }
  }
}
