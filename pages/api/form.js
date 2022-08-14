export default function handler(req, res) {
    // Get data submitted in request's body.
    const body = req.body

    if (!body.message || !body.email) {
        // Sends a HTTP bad request error code
        return res.status(400).json({ message: 'Invalid Request, please try again.' });
    }


    return res.status(200).json({ message: 'Success!' });

}