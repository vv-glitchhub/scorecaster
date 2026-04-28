import { NextResponse }
from "next/server";

import {
getOddsData
}
from "@/lib/odds-service";

export async function GET(){

const data=
await getOddsData();

return NextResponse.json(data);

}
