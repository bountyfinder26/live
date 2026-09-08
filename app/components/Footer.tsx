import React from "react";


export default function Footer() {



    return (

        <>


        <div className="min-h-[20vh] mx-auto w-4/6 flex flex-row items-center">
            <div className="">
                <div>
                    <p className="font-2 ">this was made by seba (plastuchino on da slack)</p>
                    <p className="mt-2 font-2">here are all the boring links</p>
                </div>

                <div className="flex font-2 mt-2 text-blue-500 flex-row gap-2">

                    <a href="https://hackclub.com" className="link">Hack Club!</a>
                    <a href="https://forms.hackclub.com/bounty" className="link">Fulfillment Bounty</a>
                    <a className="link" href="https://hackclub.com/privacy-and-terms#hack-club-privacy-notice">Terms of Service</a>
                    <a className="link" href="https://hackclub.com/privacy-and-terms#hack-club-standard-terms-and-conditions">Privacy Policy</a>


                </div>
            </div>

        </div>


        </>
    )
}
