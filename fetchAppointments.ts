import { SMTPClient } from 'https://deno.land/x/denomailer@1.2.0/mod.ts'
import 'https://deno.land/x/dotenv@v3.2.0/load.ts'

let storedAppointments: Appointment[] = []
let url: string | null = null

await main()
setInterval(main, 10 * 60 * 1000)

/* -------------------------------------------------------------------------- */
/*                                Main Function                               */
/* -------------------------------------------------------------------------- */

async function main() {
    const fetchedAppointments = await getAppointments()
    if (fetchedAppointments != null) {
        await Deno.writeTextFile('appointments.json', '[\n' + fetchedAppointments.map(appointment => JSON.stringify(appointment)).join(',\n') + '\n]')
        const filteredAppointments = filterAppointments(fetchedAppointments)
        if (filteredAppointments.length > 0) {
            await sendEmail(`New Appointments found: ${filteredAppointments}.\n Bürgerbüro: ${url}`)
        }
        storedAppointments = fetchedAppointments
    }
}

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */
/* -------------------------------------------------------------------------- */


async function getAppointments(): Promise<Appointment[] | null> {
    url = await getURLWithSessionId()
    if (url == null) {
        return null
    }
    const searchParams = new URLSearchParams({
        action_type: 'next_step',
        step_active: '4',
        plz: '',
        'service_b1715da7-c53d-4f73-91d3-fdf3b707bc25_amount': '0',
        'service_a919f181-f17c-4f2d-ab0c-6d24e6231468_amount': '0',
        'service_dae943f9-cf21-42cc-bebb-32187e937465_amount': '0',
        'service_1bc4e971-89d4-444c-97a5-a478da7fd63b_amount': '1',
        'service_eeb8b35e-2808-4dcd-8021-2bd9c48e1218_amount': '0',
        'service_abcca2e0-c0ff-4362-8235-31e05286e69b_amount': '0',
        'service_472f4aea-245b-40e7-a6bc-a26059966307_amount': '1',
        'service_d769ec28-fc78-40f6-9da7-3231baece5ac_amount': '0',
        'service_ae0b7857-32de-406b-9c08-767eda704a86_amount': '0',
        'service_71860144-3b12-4b5e-99b0-fd01af1ab9ea_amount': '0',
        'service_071a1e06-388b-4735-acdc-a433eeed3286_amount': '0',
        'service_4c57ee25-8b78-49e9-9ff8-a6700f9f0264_amount': '0',
        'service_6035f195-5adb-4daf-b37a-61b35944230d_amount': '0',
        'service_cd11438b-597c-4d51-8d53-2ee5b5a52ab1_amount': '0',
        'service_b46c678d-71ee-415e-8351-706922a33c82_amount': '0',
        'service_f9ecd60c-311c-463b-88b8-be18b2a1e4a3_amount': '0',
        'service_17131409-d0f7-4003-9156-93b22fc890c2_amount': '0',
        'service_a80f8d0c-5e52-4e6c-af8e-9ca9dda6742b_amount': '0',
        'service_b66e0c4e-3258-4afc-9f3e-29df6d9871dd_amount': '0',
        appointments_from: '2022-07-18'
    })
    searchParams.append('services', '')
    searchParams.append('services', '1bc4e971-89d4-444c-97a5-a478da7fd63b')
    searchParams.append('services', '472f4aea-245b-40e7-a6bc-a26059966307')
    searchParams.append('weekday', '')
    searchParams.append('weekday', '1')
    searchParams.append('weekday', '2')
    searchParams.append('weekday', '3')
    searchParams.append('weekday', '4')
    searchParams.append('weekday', '5')
    searchParams.append('time_ranges', '')
    searchParams.append('time_ranges', '0-720')
    searchParams.append('time_ranges', '720-1440')
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: searchParams,
        })
        url = response.url
        const data = await response.text()
        let appointmentsString = data.substring(data.indexOf('<!-- APPOINTMENT LIST -->'))
        appointmentsString = appointmentsString.substring(appointmentsString.indexOf('{appointments:[') + 15, appointmentsString.lastIndexOf('},') + 2)
        const appointments: Appointment[] = appointmentsString.split('},').slice(0, -1).map(appointment => {
            let appointmentObject
            eval('appointmentObject = ' + appointment + '}')
            return appointmentObject
        }) as unknown[] as Appointment[]
        return appointments
    } catch (error) {
        console.error(error)
    }
    return null
}

function filterAppointments(appointments: Appointment[]): Appointment[] {
    const newAppointments = appointments.filter(appointment => !storedAppointments.map(appointment => appointment.date_time).includes(appointment.date_time))
    if (storedAppointments.length != 0 && newAppointments.length > 0) {
        console.log('NEW APPOINTMENTS FOUND:')
        console.log(newAppointments)
        return newAppointments
    }
    return []
}

async function getURLWithSessionId(): Promise<string | null> {
    try {
        const url = (await fetch('https://stadt-karlsruhe.saas.smartcjm.com/m/stadt-karlsruhe/extern/calendar/?uid=54f4114e-d167-437b-a0d6-594406f7a0ac')).url
        console.log('Fetch was successfull. Got redirected Url: ' + url)
        return url
    } catch (error) {
        console.error(error)
    }
    return null
}

async function sendEmail(content?: string, html?: string) {
    const client = new SMTPClient({
        connection: {
            hostname: getEnv('HOSTNAME'),
            port: +getEnv('PORT'),
            auth: {
                username: getEnv('USERNAME'),
                password: getEnv('PASSWORD'),
            },
        }
    })
    console.log('Connected to SMTP server')

    await client.send({
        from: getEnv('EMAIL_FROM'),
        to: getEnv('EMAIL_TO'),
        subject: 'New appointments found',
        content: content,
        html: html,
    })
    console.log('Email was send')

    await client.close()
}

function getEnv(name: string): string {
    const value = Deno.env.get(name)
    console.log(value)
    if (value == undefined) {
        throw new Error(`'${name}' was not found in the environment`)
    }
    return value
}

type Appointment = {
    date: string,
    date_time: string,
    unit: string,
    duration: string,
    link: string
}