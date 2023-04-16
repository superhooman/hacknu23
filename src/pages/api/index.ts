import { type NextApiHandler } from "next";

const handler: NextApiHandler = (req, res) => {
    return res.status(200).json({
        ok: true,
    });
};

export default handler;
