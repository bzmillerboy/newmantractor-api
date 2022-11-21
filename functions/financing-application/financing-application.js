const { HUBSPOT_DEVELOPER_PORTAL_ID, HUBSPOT_DEVELOPER_API_KEY } = process.env
const Hubspot = require('hubspot')
const hubspot = new Hubspot({
  apiKey: HUBSPOT_DEVELOPER_API_KEY, // HUBSPOT_API_KEY,
  checkLimit: false
})

const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = 'https://vfihmsdvctcwwbtxrhfl.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async event => {
  // console.log('financing-application event:', JSON.stringify(event))
  const payload = JSON.parse(event.body)
  // console.log('financing-application payload:', payload)

  const {
    email,
    firstName,
    lastName,
    phone,
    hutk,
    businessName,
    structure,
    amount,
    equipmentSkus,
    signature,
    status,
    applicationIds
  } = payload

  const hubSpotFormData = {
    fields: [
      {
        name: 'email',
        value: email
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
        value: phone
      },
      {
        name: 'finance_application_url',
        value: event.headers.referer || ''
      }
    ],
    context: {
      hutk: hutk && hutk, // include this parameter and set it to the hubspotutk cookie value to enable cookie tracking on your submission
      pageUri: event.headers.referer || ''
    }
  }

  console.log('existing ids found:', applicationIds)

  try {
    const { data: addressesData, error: addressesError } = await supabase
      .from('addresses')
      .upsert({
        ...(applicationIds?.addressId && { id: applicationIds.addressId }),
        address: '123 Main St-1',
        address2: 'Apt 1',
        city: 'San Francisco',
        state: 'CA',
        postal_code: 94105,
        country: 'US',
        county: 'San Francisco'
      })
      .select()
    console.log('addresses data:', addressesData)
    console.log('addresses error:', addressesError)
    const address = addressesData[0]

    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .upsert({
        ...(applicationIds?.contactId && { id: applicationIds.contactId }),
        ...(firstName && { first_name: firstName }),
        ...(lastName && { last_name: lastName }),
        ...(email && { email: email }),
        ...(phone && { phone: phone.replace(/[^0-9]/g, '') }),
        address: address.id,
        type: 'customer'
      })
      .select()

    console.log('contacts data:', contactsData)
    console.log('contacts error:', contactsError)
    const contact = contactsData[0]

    const { data: applicationsData, error: applicationsError } = await supabase
      .from('applications')
      .upsert({
        ...(applicationIds?.applicationId && { id: applicationIds.applicationId }),
        contact_customer: contact.id,
        // contact_owner: 29,
        ...(status && { status: status }),
        ...(amount && { amount: amount }),
        location: 1,
        ...(businessName && { business_name: businessName }),
        ...(structure && { business_structure: structure }),
        ...(amount && { amount: amount }),
        ...(equipmentSkus && { equipment_skus: equipmentSkus }),
        ...(signature && { signature: signature })
      })
      .select()

    console.log('applications error:', applicationsError)
    console.log('applications data:', applicationsData)
    const application = applicationsData[0]

    const dbResponse = {
      applicationId: application.id,
      contactId: contact.id,
      addressId: address.id
    }

    // const hubSpotApiResponse =
    // hutk &&
    // (await hubspot.forms.submit(
    //   HUBSPOT_DEVELOPER_PORTAL_ID,
    //   '06b43cab-dc84-42fa-8a9e-b4fa7397b034', // Current prod form ID '3f9e682b-bb9a-40bf-9b9b-69ee97c82960',
    //   hubSpotFormData
    // ))
    if (contactsError || addressesError || applicationsError) {
      throw contactsError || addressesError || applicationsError
    }
    if (!contactsError && !addressesError && !applicationsError) {
      return {
        statusCode: 200,
        body: JSON.stringify(dbResponse),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    }
  } catch (error) {
    console.log('the api has an error', error)
    return {
      statusCode: error.statusCode || error.code,
      body: `${error.message || error.body.message} - ${JSON.stringify(error.response.body.errors)}`
    }
  }
}
