import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgCheck = `${assetPathPrefix}/check-source.svg`;
const imgClock = `${assetPathPrefix}/clock-source.svg`;
const imgCheckCircle = `${assetPathPrefix}/08486.svg`;
const imgStepIndicator = `${assetPathPrefix}/bfe79.svg`;
const imgStepIndicator1 = `${assetPathPrefix}/14cec.svg`;
const imgSourcePhotograph = `${assetPathPrefix}/01e71.png`;
const imgApprovedIcon = `${assetPathPrefix}/1d14e.svg`;
const imgLayoutAlt01 = `${assetPathPrefix}/3159a.svg`;
const imgTruck = `${assetPathPrefix}/aac1c.svg`;
const imgReceipt = `${assetPathPrefix}/53c0a.svg`;
const imgWallet04 = `${assetPathPrefix}/87ec9.svg`;
const imgTicket01 = `${assetPathPrefix}/4546e.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/bbad0.svg`;
const imgSearchIcon = `${assetPathPrefix}/af369.svg`;
const imgBell = `${assetPathPrefix}/182b5.svg`;
const imgHelpCircle = `${assetPathPrefix}/8ed5b.svg`;
const imgArchive = `${assetPathPrefix}/c9698.svg`;
const imgTruck1 = `${assetPathPrefix}/f55ea.svg`;
const imgNavigation = `${assetPathPrefix}/05849.svg`;
const imgEscrowIcon = `${assetPathPrefix}/efa18.svg`;
type LeetlogicIOsTicketTimelineStepProps = {
  className?: string;
  children?: React.ReactNode | null;
  state?: "Complete" | "Current" | "Pending";
};
function LeetlogicIOsTicketTimelineStep({
  className,
  children = null,
  state = "Complete",
}: LeetlogicIOsTicketTimelineStepProps) {
  const isCurrent = state === "Current";
  const isPending = state === "Pending";
  return (
    <div
      className={
        className ||
        `admin-element-acf0c0686 ${isCurrent ? "admin-element-46d715011" : "admin-element-10653a17b"}`
      }
      id={isPending ? "node-2521_20943" : isCurrent ? "node-2521_20927" : "node-2521_20917"}
    >
      {state === "Complete" && (
        <div className="admin-element-9fbde6c24" data-node-id="2521:20918" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-99caea249"
                data-node-id="2521:20919"
                data-name="Progress indicator"
              >
                <div
                  className="admin-element-50e0e3a4d"
                  data-node-id="2521:20920"
                  data-name="Step indicator"
                >
                  <div
                    className="admin-element-58d29b27c"
                    data-node-id="2521:20921"
                    data-name="check-circle"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgCheckCircle} />
                  </div>
                </div>
              </div>
              <div
                className="admin-element-c13ac1614"
                data-node-id="2521:20922"
                data-name="Step content"
              >
                <div
                  className="admin-element-076eee34e"
                  data-node-id="2521:20923"
                  data-name="Step heading"
                >
                  <p
                    className="admin-element-4a3957ff6"
                    data-node-id="2521:20924"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Sent yesterday
                  </p>
                  <p
                    className="admin-element-b4dd18b57"
                    data-node-id="2521:20925"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    3:45 PM
                  </p>
                </div>
                <p
                  className="admin-element-0a7811f61"
                  data-node-id="2521:20926"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Ticket created by buyer with 4 photographic attachments
                </p>
              </div>
            </>
          )}
        </div>
      )}
      {isCurrent && (
        <div className="admin-element-9fbde6c24" data-node-id="2521:20928" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-99caea249"
                data-node-id="2521:20929"
                data-name="Progress indicator"
              >
                <div
                  className="admin-element-f84de7678"
                  data-node-id="2521:20930"
                  data-name="Step indicator"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgStepIndicator} />
                </div>
              </div>
              <div
                className="admin-element-bb7872a18"
                data-node-id="2521:20932"
                data-name="Step content"
              >
                <div
                  className="admin-element-076eee34e"
                  data-node-id="2521:20933"
                  data-name="Step heading"
                >
                  <p
                    className="admin-element-feb73536f"
                    data-node-id="2521:20934"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    In review now
                  </p>
                  <div
                    className="admin-element-14ef993ea"
                    data-node-id="2521:20935"
                    data-name="Badge"
                  >
                    <p
                      className="admin-element-ba6c094ce"
                      data-node-id="2521:20936"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Current step
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-eae351352"
                  data-node-id="2521:20937"
                  data-name="Review assignment"
                >
                  <p
                    className="admin-element-af9acb1cc"
                    data-node-id="2521:20938"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    <span className="admin-element-a4d2b1ada">{`Assigned to `}</span>
                    <span
                      className="admin-element-deaf3fc94"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Amaka (Claims Officer)
                    </span>
                    <span className="admin-element-a4d2b1ada">
                      . Evidence photos being verified against courier delivery log.
                    </span>
                  </p>
                  <div
                    className="admin-element-076eee34e"
                    data-node-id="2521:20939"
                    data-name="Response expectation"
                  >
                    <div
                      className="admin-element-3fbb3e70c"
                      data-node-id="2521:20940"
                      data-name="Officer avatar"
                    >
                      <p
                        className="admin-element-b211b207e"
                        data-node-id="2521:20941"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        AO
                      </p>
                    </div>
                    <p
                      className="admin-element-422ead477"
                      data-node-id="2521:20942"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Expected response within 3 hours
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {isPending && (
        <div className="admin-element-9fbde6c24" data-node-id="2521:20944" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-99caea249"
                data-node-id="2521:20945"
                data-name="Progress indicator"
              >
                <div
                  className="admin-element-f84de7678"
                  data-node-id="2521:20946"
                  data-name="Step indicator"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgStepIndicator1} />
                </div>
              </div>
              <div
                className="admin-element-bb7872a18"
                data-node-id="2521:20948"
                data-name="Step content"
              >
                <div
                  className="admin-element-7abd32769"
                  data-node-id="2521:20949"
                  data-name="Step heading"
                >
                  <p
                    className="admin-element-bbd07bdb0"
                    data-node-id="2521:20950"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Waiting on you
                  </p>
                </div>
                <p
                  className="admin-element-aaa436472"
                  data-node-id="2521:20951"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  If additional damage photos or unboxing details are needed
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export default function Component2301OrderDetailAndEscrow() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:44500"
      data-name="23.01 · Order detail and escrow"
    >
      <div className="admin-element-6a9160556" data-node-id="2521:44501" data-name="Staff sidebar">
        <div
          className="admin-element-47aacf6d1"
          data-node-id="2521:44502"
          data-name="Leetlogic identity"
        >
          <div
            className="admin-element-98312d2eb"
            data-node-id="2521:44503"
            data-name="Approved icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgApprovedIcon} />
          </div>
          <p className="admin-element-95dcd1624" data-node-id="2521:44506">
            Leetlogic
          </p>
        </div>
        <p
          className="admin-element-d850d511d"
          data-node-id="2521:44507"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          OPS PORTAL
        </p>
        <div
          className="admin-element-c49082262"
          data-node-id="2521:44508"
          data-name="Staff profile"
        >
          <div className="admin-element-47aacf6d1" data-node-id="2521:44509" data-name="Details">
            <div className="admin-element-fa034075d" data-node-id="2521:44510" data-name="Avatar">
              <p
                className="admin-element-98975eb29"
                data-node-id="2521:44511"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                A
              </p>
            </div>
            <div className="admin-element-d21287ddd" data-node-id="2521:44512" data-name="Identity">
              <p
                className="admin-element-08fd34b76"
                data-node-id="2521:44513"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Amaka O.
              </p>
              <p
                className="admin-element-ee7109148"
                data-node-id="2521:44514"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >{`Operations & Finance`}</p>
            </div>
          </div>
        </div>
        <div
          className="admin-element-fe2923e63"
          data-node-id="2521:44515"
          data-name="Staff navigation"
        >
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:44516"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:44517"
              data-name="layout-alt-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutAlt01} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:44518"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-8168e843e"
            data-node-id="2521:44519"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:44520" data-name="truck">
              <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
            </div>
            <Link
              className="admin-element-666310f2b"
              data-node-id="2521:44521"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/orders"
            >{`Orders & Escrow`}</Link>
          </div>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:44522"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:44523" data-name="receipt">
              <img alt="" className="admin-element-8faf267d3" src={imgReceipt} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:44524"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/reconciliation"
            >
              Reconciliation
            </Link>
          </div>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:44525"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:44526"
              data-name="wallet-04"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgWallet04} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:44527"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/withdrawals"
            >
              Withdrawals
            </Link>
          </div>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:44528"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:44529"
              data-name="ticket-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgTicket01} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:44530"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/disputes"
            >
              Dispute Queue
            </Link>
          </div>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:44531"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:44532"
              data-name="check-verified-03"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:44533"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/verification"
            >
              Verification
            </Link>
          </div>
        </div>
        <div className="admin-element-2858ff3cb" data-node-id="2521:44534" data-name="Session">
          <Link
            className="admin-element-9c5c77dce"
            data-node-id="2521:44535"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/login"
          >
            Log out
          </Link>
        </div>
      </div>
      <div
        className="admin-element-7c219a7f7"
        data-node-id="2521:44536"
        data-name="Staff workspace"
      >
        <div className="admin-element-5a294230a" data-node-id="2521:44537" data-name="Top bar">
          <div
            className="admin-element-7e8b60cc1"
            data-node-id="2521:44538"
            data-name="Search container"
          >
            <div className="admin-element-c45c17760" data-node-id="2521:44539" data-name="Search">
              <div
                className="admin-element-b2a182ecf"
                data-node-id="2521:44540"
                data-name="Search icon"
              >
                <img alt="" className="admin-element-8faf267d3" src={imgSearchIcon} />
              </div>
              <AdminField
                className="admin-element-db0bc8c58"
                data-node-id="2521:44541"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                label="Search ID, merchant, ticket, or batch..."
                search
              />
            </div>
          </div>
          <div className="admin-element-ad3903416" data-node-id="2521:44542" data-name="Status">
            <p
              className="admin-element-853146de1"
              data-node-id="2521:44543"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ● System Live · Lagos DC: 28ms
            </p>
          </div>
          <div className="admin-element-35368e319" data-node-id="2521:44544" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <div
            className="admin-element-35368e319"
            data-node-id="2521:44545"
            data-name="help-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgHelpCircle} />
          </div>
          <p
            className="admin-element-6570fff4b"
            data-node-id="2521:44546"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Amaka O.
          </p>
        </div>
        <div
          className="admin-element-597aaf720"
          data-node-id="2521:44547"
          data-name="Workspace content"
        >
          <div className="admin-element-47aacf6d1" data-node-id="2521:44548" data-name="Details">
            <p
              className="admin-element-57afd4192"
              data-node-id="2521:44549"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Orders & Escrow › Order #ORD-7824 › Adaeze Okafor`}</p>
            <AdminControl
              className="admin-element-978921456"
              data-node-id="2521:44550"
              data-name="Secondary action"
            >
              <p
                className="admin-element-ccf92a798"
                data-node-id="2521:44551"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Print Waybill
              </p>
            </AdminControl>
            <AdminControl
              className="admin-element-978921456"
              data-node-id="2521:44552"
              data-name="Secondary action"
            >
              <p
                className="admin-element-ccf92a798"
                data-node-id="2521:44553"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Contact Driver
              </p>
            </AdminControl>
            <AdminControl
              className="admin-element-35d3629de"
              data-node-id="2521:44554"
              data-name="Secondary action"
            >
              <p
                className="admin-element-ccf92a798"
                data-node-id="2521:44555"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Flag Order
              </p>
            </AdminControl>
          </div>
          <div
            className="admin-element-c9a574dea"
            data-node-id="2521:44556"
            data-name="Order summary"
          >
            <div className="admin-element-47aacf6d1" data-node-id="2521:44557" data-name="Details">
              <div
                className="admin-element-990094099"
                data-node-id="2521:44558"
                data-name="Order identity"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44559"
                  data-name="Details"
                >
                  <p className="admin-element-f5acdb999" data-node-id="2521:44560">
                    Order #ORD-7824
                  </p>
                  <div
                    className="admin-element-3ecb999ef"
                    data-node-id="2521:44561"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-a3c2d98c9"
                      data-node-id="2521:44562"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Status: In Transit
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-d0d06bbd0"
                  data-node-id="2521:44563"
                  data-name="Status"
                >
                  <p
                    className="admin-element-5d78ec74b"
                    data-node-id="2521:44564"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Escrow Protected
                  </p>
                </div>
                <p
                  className="admin-element-a44744795"
                  data-node-id="2521:44565"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Adaeze Okafor · Lekki Phase 1, Lagos State
                </p>
                <p
                  className="admin-element-a44744795"
                  data-node-id="2521:44566"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Created 24 Oct, 08:30 AM WAT
                </p>
              </div>
              <div
                className="admin-element-5e52b5266"
                data-node-id="2521:44567"
                data-name="Value and custody"
              >
                <div className="admin-element-5e1ab59f4" data-node-id="2521:44568" data-name="Card">
                  <p
                    className="admin-element-66c5136e9"
                    data-node-id="2521:44569"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    TOTAL VALUE
                  </p>
                  <p className="admin-element-2e7becf45" data-node-id="2521:44570">
                    ₦35,600
                  </p>
                  <p
                    className="admin-element-ea0a179c0"
                    data-node-id="2521:44571"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Custody State · Full Vault Hold
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-c93a8f5ce"
            data-node-id="2521:44572"
            data-name="Order operations"
          >
            <div
              className="admin-element-3d7de8083"
              data-node-id="2521:44573"
              data-name="Produce and shipment"
            >
              <div
                className="admin-element-94e1aa569"
                data-node-id="2521:44574"
                data-name="Produce and order breakdown"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44575"
                  data-name="Details"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:44576"
                    data-name="archive"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgArchive} />
                  </div>
                  <p
                    className="admin-element-17ad1734a"
                    data-node-id="2521:44577"
                  >{`Produce & Order Breakdown`}</p>
                  <p
                    className="admin-element-43fac531d"
                    data-node-id="2521:44578"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Batch Ref: #LOT-EBO-291
                  </p>
                </div>
                <div
                  className="admin-element-9d8b1466d"
                  data-node-id="2521:44579"
                  data-name="Produce payload"
                >
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:44580"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-0c0428642"
                      data-node-id="2521:44581"
                      data-name="Source photograph"
                    >
                      <div className="admin-element-45d68c69e">
                        <img alt="" className="admin-element-d97b2217a" src={imgSourcePhotograph} />
                      </div>
                    </div>
                    <div
                      className="admin-element-b107ca056"
                      data-node-id="2521:44582"
                      data-name="Product details"
                    >
                      <p
                        className="admin-element-4f0af6b47"
                        data-node-id="2521:44583"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Fresh Roma Tomatoes (Grade A)
                      </p>
                      <div
                        className="admin-element-61426f31e"
                        data-node-id="2521:44584"
                        data-name="Status"
                      >
                        <p
                          className="admin-element-5d78ec74b"
                          data-node-id="2521:44585"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          PREMIUM EXPORT GRADE
                        </p>
                      </div>
                      <p
                        className="admin-element-a44744795"
                        data-node-id="2521:44586"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Direct harvest: hand-sorted, uniform firmness, zero surface bruising.
                      </p>
                      <p
                        className="admin-element-095cb6220"
                        data-node-id="2521:44587"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        4 large baskets (~160 kg) · Organic Standard
                      </p>
                      <p
                        className="admin-element-095cb6220"
                        data-node-id="2521:44588"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Target: 12°C Controlled
                      </p>
                    </div>
                    <div
                      className="admin-element-0b242183f"
                      data-node-id="2521:44589"
                      data-name="Product price"
                    >
                      <p
                        className="admin-element-fc65763f1"
                        data-node-id="2521:44590"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        ₦32,000
                      </p>
                      <p
                        className="admin-element-5a7d6aeb8"
                        data-node-id="2521:44591"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        ₦8,000 / basket
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-eb8325b57"
                  data-node-id="2521:44592"
                  data-name="Farmer identity"
                >
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:44593"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-61426f31e"
                      data-node-id="2521:44594"
                      data-name="Status"
                    >
                      <p
                        className="admin-element-5d78ec74b"
                        data-node-id="2521:44595"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        CS
                      </p>
                    </div>
                    <div
                      className="admin-element-f06f3a4af"
                      data-node-id="2521:44596"
                      data-name="Farmer"
                    >
                      <p
                        className="admin-element-fc65763f1"
                        data-node-id="2521:44597"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Chibuzor Simon · Verified Farmer
                      </p>
                      <p
                        className="admin-element-5a7d6aeb8"
                        data-node-id="2521:44598"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        #FRM-4092 · Abakaliki LGA, Ebonyi State
                      </p>
                    </div>
                    <p
                      className="admin-element-a6c5d6ae0"
                      data-node-id="2521:44599"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      View Ledger
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-c6d2d846f"
                  data-node-id="2521:44600"
                  data-name="Summary row"
                >
                  <p
                    className="admin-element-ccdc7ad93"
                    data-node-id="2521:44601"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Produce Subtotal (4 units @ ₦8,000)
                  </p>
                  <p
                    className="admin-element-8290570ad"
                    data-node-id="2521:44602"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦32,000.00
                  </p>
                </div>
                <div
                  className="admin-element-c6d2d846f"
                  data-node-id="2521:44603"
                  data-name="Summary row"
                >
                  <p
                    className="admin-element-ccdc7ad93"
                    data-node-id="2521:44604"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Nationwide Reefer Dispatch
                  </p>
                  <p
                    className="admin-element-8290570ad"
                    data-node-id="2521:44605"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦3,000.00
                  </p>
                </div>
                <div
                  className="admin-element-c6d2d846f"
                  data-node-id="2521:44606"
                  data-name="Summary row"
                >
                  <p
                    className="admin-element-ccdc7ad93"
                    data-node-id="2521:44607"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`Leetlogic Escrow & Assurance Fee (1.7%)`}</p>
                  <p
                    className="admin-element-8290570ad"
                    data-node-id="2521:44608"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦600.00
                  </p>
                </div>
                <div
                  className="admin-element-3f60357e2"
                  data-node-id="2521:44609"
                  data-name="Divider"
                />
                <div
                  className="admin-element-c6f5f0c30"
                  data-node-id="2521:44610"
                  data-name="Summary row"
                >
                  <p
                    className="admin-element-26954d694"
                    data-node-id="2521:44611"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Total Paid by Buyer
                  </p>
                  <p className="admin-element-1264581d2" data-node-id="2521:44612">
                    ₦35,600.00
                  </p>
                </div>
                <p
                  className="admin-element-a44e479fa"
                  data-node-id="2521:44613"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  100% secured in Leetlogic Escrow Liquidity Pool [GTBank Custodial Sub-Account]
                </p>
              </div>
              <div
                className="admin-element-958f67068"
                data-node-id="2521:44614"
                data-name="Shipment route and escrow timeline"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44615"
                  data-name="Details"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:44616"
                    data-name="truck"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgTruck1} />
                  </div>
                  <p
                    className="admin-element-17ad1734a"
                    data-node-id="2521:44617"
                  >{`Shipment Route & Escrow Timeline`}</p>
                  <div
                    className="admin-element-61426f31e"
                    data-node-id="2521:44618"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-5d78ec74b"
                      data-node-id="2521:44619"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      ● Live GPS Feed Active
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-f6db54efb"
                  data-node-id="2521:44620"
                  data-name="Active shipment vector"
                >
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:44621"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:44622"
                      data-name="navigation"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgNavigation} />
                    </div>
                    <div
                      className="admin-element-9822e5fdf"
                      data-node-id="2521:44623"
                      data-name="Route"
                    >
                      <p
                        className="admin-element-68e7d3268"
                        data-node-id="2521:44624"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        ACTIVE VECTOR
                      </p>
                      <p
                        className="admin-element-1bc30747f"
                        data-node-id="2521:44625"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Lagos-Benin-Ore Expressway
                      </p>
                      <p
                        className="admin-element-68e7d3268"
                        data-node-id="2521:44626"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Crossed Ore interchange · Heading toward Sagamu hub
                      </p>
                    </div>
                    <div
                      className="admin-element-da89fe053"
                      data-node-id="2521:44627"
                      data-name="Arrival"
                    >
                      <p
                        className="admin-element-66c5136e9"
                        data-node-id="2521:44628"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        ESTIMATED ARRIVAL
                      </p>
                      <p className="admin-element-997c0eeda" data-node-id="2521:44629">
                        4h 15m
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-524a6438d"
                  data-node-id="2521:44630"
                  data-name="Route milestones"
                >
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:44631"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-43972e635"
                      data-node-id="2521:44632"
                      data-name="Card"
                    >
                      <p
                        className="admin-element-4ca3fb38c"
                        data-node-id="2521:44633"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        ● Abakaliki Hub (Departed)
                      </p>
                    </div>
                    <div
                      className="admin-element-8bcfe1711"
                      data-node-id="2521:44634"
                      data-name="Card"
                    >
                      <p
                        className="admin-element-4ca3fb38c"
                        data-node-id="2521:44635"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Km 114 Ore (In-transit)
                      </p>
                    </div>
                    <div
                      className="admin-element-43972e635"
                      data-node-id="2521:44636"
                      data-name="Card"
                    >
                      <p
                        className="admin-element-4ca3fb38c"
                        data-node-id="2521:44637"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        ● Lekki Lagos (Destination)
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-5c941ab3a"
                  data-node-id="2521:44638"
                  data-name="Shipment timeline step"
                >
                  <LeetlogicIOsTicketTimelineStep className="admin-element-39c928f2c">
                    <div
                      className="admin-element-10ccd443e"
                      data-node-id="2521:44640"
                      data-name="Milestone content"
                    >
                      <div
                        className="admin-element-281d5e73e"
                        data-node-id="2521:44641"
                        data-name="Progress marker"
                      >
                        <div
                          className="admin-element-c51752dc8"
                          data-node-id="2521:44642"
                          data-name="check"
                        >
                          <img alt="" className="admin-timeline-glyph" src={imgCheck} />
                        </div>
                      </div>
                      <div
                        className="admin-element-2f996318d"
                        data-node-id="2521:44643"
                        data-name="Milestone details"
                      >
                        <div
                          className="admin-element-77ac1a8a3"
                          data-node-id="2521:44644"
                          data-name="Details"
                        >
                          <p
                            className="admin-element-a193aa4c1"
                            data-node-id="2521:44645"
                          >{`Order placed & Escrow locked`}</p>
                          <p className="admin-element-c2fa302da" data-node-id="2521:44646">
                            24 Oct, 08:30 AM
                          </p>
                        </div>
                        <p className="admin-element-19ff38b79" data-node-id="2521:44647">
                          Paid via Card · ₦35,600 held securely in GTBank Custodial Escrow. Auth
                          Token #TX-901824.
                        </p>
                      </div>
                    </div>
                  </LeetlogicIOsTicketTimelineStep>
                </div>
                <div
                  className="admin-element-5c941ab3a"
                  data-node-id="2521:44649"
                  data-name="Shipment timeline step"
                >
                  <LeetlogicIOsTicketTimelineStep className="admin-element-39c928f2c">
                    <div
                      className="admin-element-10ccd443e"
                      data-node-id="2521:44651"
                      data-name="Milestone content"
                    >
                      <div
                        className="admin-element-281d5e73e"
                        data-node-id="2521:44652"
                        data-name="Progress marker"
                      >
                        <div
                          className="admin-element-c51752dc8"
                          data-node-id="2521:44653"
                          data-name="check"
                        >
                          <img alt="" className="admin-timeline-glyph" src={imgCheck} />
                        </div>
                      </div>
                      <div
                        className="admin-element-2f996318d"
                        data-node-id="2521:44654"
                        data-name="Milestone details"
                      >
                        <div
                          className="admin-element-77ac1a8a3"
                          data-node-id="2521:44655"
                          data-name="Details"
                        >
                          <p
                            className="admin-element-a193aa4c1"
                            data-node-id="2521:44656"
                          >{`Farmer accepted & produce packed`}</p>
                          <p className="admin-element-c2fa302da" data-node-id="2521:44657">
                            24 Oct, 10:15 AM
                          </p>
                        </div>
                        <p className="admin-element-19ff38b79" data-node-id="2521:44658">
                          Verified Grade A quality standards at Abakaliki Agrarian Aggregation
                          Centre. Weight certified: 161.4 kg net.
                        </p>
                      </div>
                    </div>
                  </LeetlogicIOsTicketTimelineStep>
                </div>
                <div
                  className="admin-element-5c941ab3a"
                  data-node-id="2521:44660"
                  data-name="Shipment timeline step"
                >
                  <LeetlogicIOsTicketTimelineStep className="admin-element-39c928f2c">
                    <div
                      className="admin-element-10ccd443e"
                      data-node-id="2521:44662"
                      data-name="Milestone content"
                    >
                      <div
                        className="admin-element-281d5e73e"
                        data-node-id="2521:44663"
                        data-name="Progress marker"
                      >
                        <div
                          className="admin-element-c51752dc8"
                          data-node-id="2521:44664"
                          data-name="check"
                        >
                          <img alt="" className="admin-timeline-glyph" src={imgCheck} />
                        </div>
                      </div>
                      <div
                        className="admin-element-2f996318d"
                        data-node-id="2521:44665"
                        data-name="Milestone details"
                      >
                        <div
                          className="admin-element-77ac1a8a3"
                          data-node-id="2521:44666"
                          data-name="Details"
                        >
                          <p
                            className="admin-element-a193aa4c1"
                            data-node-id="2521:44667"
                          >{`Driver assigned & dispatched`}</p>
                          <p className="admin-element-c2fa302da" data-node-id="2521:44668">
                            24 Oct, 01:20 PM
                          </p>
                        </div>
                        <p className="admin-element-19ff38b79" data-node-id="2521:44669">
                          Handed over to Leetlogic Logistics partner Chinedu Obi (Vehicle
                          KJA-412-XA, Reefer compartment set at 11.8°C).
                        </p>
                      </div>
                    </div>
                  </LeetlogicIOsTicketTimelineStep>
                </div>
                <div
                  className="admin-element-5c941ab3a"
                  data-node-id="2521:44671"
                  data-name="Shipment timeline step"
                >
                  <LeetlogicIOsTicketTimelineStep
                    className="admin-element-39c928f2c"
                    state="Current"
                  >
                    <div
                      className="admin-element-10ccd443e"
                      data-node-id="2521:44673"
                      data-name="Milestone content"
                    >
                      <div
                        className="admin-element-281d5e73e"
                        data-node-id="2521:44674"
                        data-name="Progress marker"
                      >
                        <div
                          className="admin-element-c51752dc8"
                          data-node-id="2521:44675"
                          data-name="check"
                        >
                          <img alt="" className="admin-timeline-glyph" src={imgCheck} />
                        </div>
                      </div>
                      <div
                        className="admin-element-e4ed51c9f"
                        data-node-id="2521:44676"
                        data-name="Milestone details"
                      >
                        <div
                          className="admin-element-47aacf6d1"
                          data-node-id="2521:44677"
                          data-name="Details"
                        >
                          <p className="admin-element-e245d3541" data-node-id="2521:44678">
                            In transit to Lagos Mile 12 Depot
                          </p>
                          <p className="admin-element-ce69e7e22" data-node-id="2521:44679">
                            24 Oct, 04:45 PM (Live)
                          </p>
                        </div>
                        <p className="admin-element-789d7af06" data-node-id="2521:44680">
                          Reefer unit operational. Sensor reading: 12.2°C ambient cold storage.
                          Approaching Ore toll corridor smoothly.
                        </p>
                      </div>
                    </div>
                  </LeetlogicIOsTicketTimelineStep>
                </div>
                <div
                  className="admin-element-5c941ab3a"
                  data-node-id="2521:44682"
                  data-name="Shipment timeline step"
                >
                  <LeetlogicIOsTicketTimelineStep
                    className="admin-element-39c928f2c"
                    state="Pending"
                  >
                    <div
                      className="admin-element-10ccd443e"
                      data-node-id="2521:44684"
                      data-name="Milestone content"
                    >
                      <div
                        className="admin-element-34b9b0446"
                        data-node-id="2521:44685"
                        data-name="Progress marker"
                      >
                        <div
                          className="admin-element-c51752dc8"
                          data-node-id="2521:44686"
                          data-name="clock"
                        >
                          <img alt="" className="admin-timeline-glyph" src={imgClock} />
                        </div>
                      </div>
                      <div
                        className="admin-element-2f996318d"
                        data-node-id="2521:44687"
                        data-name="Milestone details"
                      >
                        <div
                          className="admin-element-47aacf6d1"
                          data-node-id="2521:44688"
                          data-name="Details"
                        >
                          <p className="admin-element-278e5538e" data-node-id="2521:44689">
                            Delivery to buyer doorstep
                          </p>
                          <p className="admin-element-622ae594b" data-node-id="2521:44690">
                            ETA: Today, ~09:00 PM
                          </p>
                        </div>
                        <p
                          className="admin-element-19ff38b79"
                          data-node-id="2521:44691"
                        >{`Plot 14 Admiralty Way, Lekki Phase 1. Destination inspection & 4-digit confirmation token verification.`}</p>
                      </div>
                    </div>
                  </LeetlogicIOsTicketTimelineStep>
                </div>
                <div
                  className="admin-element-5c941ab3a"
                  data-node-id="2521:44693"
                  data-name="Shipment timeline step"
                >
                  <LeetlogicIOsTicketTimelineStep
                    className="admin-element-39c928f2c"
                    state="Pending"
                  >
                    <div
                      className="admin-element-10ccd443e"
                      data-node-id="2521:44695"
                      data-name="Milestone content"
                    >
                      <div
                        className="admin-element-34b9b0446"
                        data-node-id="2521:44696"
                        data-name="Progress marker"
                      >
                        <div
                          className="admin-element-c51752dc8"
                          data-node-id="2521:44697"
                          data-name="clock"
                        >
                          <img alt="" className="admin-timeline-glyph" src={imgClock} />
                        </div>
                      </div>
                      <div
                        className="admin-element-2f996318d"
                        data-node-id="2521:44698"
                        data-name="Milestone details"
                      >
                        <div
                          className="admin-element-47aacf6d1"
                          data-node-id="2521:44699"
                          data-name="Details"
                        >
                          <p className="admin-element-278e5538e" data-node-id="2521:44700">
                            Escrow payout release to Farmer Chibuzor
                          </p>
                          <p className="admin-element-622ae594b" data-node-id="2521:44701">
                            Awaiting Step 5
                          </p>
                        </div>
                        <p className="admin-element-19ff38b79" data-node-id="2521:44702">
                          Instant automated credit to farmer wallet upon recipient OTP submission or
                          24-hr silent grace window.
                        </p>
                      </div>
                    </div>
                  </LeetlogicIOsTicketTimelineStep>
                </div>
              </div>
            </div>
            <div
              className="admin-element-210e87f98"
              data-node-id="2521:44704"
              data-name="Buyer carrier and escrow"
            >
              <div
                className="admin-element-7901e6a00"
                data-node-id="2521:44705"
                data-name="Buyer order card"
              >
                <p className="admin-element-f6b7edd74" data-node-id="2521:44706">
                  Buyer Profile
                </p>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44707"
                  data-name="Details"
                >
                  <div
                    className="admin-element-3ecb999ef"
                    data-node-id="2521:44708"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-a3c2d98c9"
                      data-node-id="2521:44709"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      AO
                    </p>
                  </div>
                  <div
                    className="admin-element-d21287ddd"
                    data-node-id="2521:44710"
                    data-name="Buyer identity"
                  >
                    <p
                      className="admin-element-7e61928b7"
                      data-node-id="2521:44711"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Adaeze Okafor
                    </p>
                    <p
                      className="admin-element-2340158b1"
                      data-node-id="2521:44712"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Verified Tier-1 Buyer
                    </p>
                  </div>
                </div>
                <p
                  className="admin-element-49486ebf3"
                  data-node-id="2521:44713"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Phone number
                </p>
                <p
                  className="admin-element-f0f03052c"
                  data-node-id="2521:44714"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  +234 812 400 8921
                </p>
                <p
                  className="admin-element-49486ebf3"
                  data-node-id="2521:44715"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Delivery Address
                </p>
                <div
                  className="admin-element-af9acb1cc"
                  data-node-id="2521:44716"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  <p className="admin-element-96eff31b5">Plot 14, Admiralty Way</p>
                  <p className="admin-element-a4d2b1ada">Lekki Phase 1, Lagos, Nigeria</p>
                </div>
                <div className="admin-element-082a44da6" data-node-id="2521:44717" data-name="Card">
                  <p
                    className="admin-element-4ca3fb38c"
                    data-node-id="2521:44718"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Note: Security gate call upon arrival. House 2B behind main complex.
                  </p>
                </div>
                <p
                  className="admin-element-4ca3fb38c"
                  data-node-id="2521:44719"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Completed Orders: 38 · 5.0 Buyer Score
                </p>
              </div>
              <div
                className="admin-element-7901e6a00"
                data-node-id="2521:44720"
                data-name="Carrier order card"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44721"
                  data-name="Details"
                >
                  <p className="admin-element-17ad1734a" data-node-id="2521:44722">
                    Carrier Details
                  </p>
                  <div
                    className="admin-element-d0d06bbd0"
                    data-node-id="2521:44723"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-5d78ec74b"
                      data-node-id="2521:44724"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Active Fleet
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44725"
                  data-name="Details"
                >
                  <div
                    className="admin-element-2e4443a60"
                    data-node-id="2521:44726"
                    data-name="Source photograph"
                  >
                    <div className="admin-element-45d68c69e">
                      <img alt="" className="admin-element-35ae89e62" src={imgSourcePhotograph} />
                    </div>
                  </div>
                  <div
                    className="admin-element-f06f3a4af"
                    data-node-id="2521:44727"
                    data-name="Carrier identity"
                  >
                    <p
                      className="admin-element-fc65763f1"
                      data-node-id="2521:44728"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Chinedu Obi
                    </p>
                    <p
                      className="admin-element-5a7d6aeb8"
                      data-node-id="2521:44729"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Leetlogic Logistics Partner
                    </p>
                  </div>
                </div>
                <div className="admin-element-082a44da6" data-node-id="2521:44730" data-name="Card">
                  <p
                    className="admin-element-4ca3fb38c"
                    data-node-id="2521:44731"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ★ 4.9 · 412 successful hauls · Top Rated
                  </p>
                </div>
                <div
                  className="admin-element-af9acb1cc"
                  data-node-id="2521:44732"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  <p className="admin-element-96eff31b5">Truck Model</p>
                  <p className="admin-element-a4d2b1ada">Isuzu NPR Reefer (3.5T)</p>
                </div>
                <p
                  className="admin-element-f0f03052c"
                  data-node-id="2521:44733"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  License Plate · KJA-412-XA
                </p>
                <p
                  className="admin-element-f0f03052c"
                  data-node-id="2521:44734"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Contact · +234 802 331 9901
                </p>
                <AdminControl
                  className="admin-element-4a9ad909c"
                  data-node-id="2521:44735"
                  data-name="Secondary action"
                >
                  <p
                    className="admin-element-ccf92a798"
                    data-node-id="2521:44736"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Ping In-Cab Terminal
                  </p>
                </AdminControl>
              </div>
              <div
                className="admin-element-7901e6a00"
                data-node-id="2521:44737"
                data-name="Escrow order card"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44738"
                  data-name="Details"
                >
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:44739"
                    data-name="Escrow icon"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgEscrowIcon} />
                  </div>
                  <p className="admin-element-17ad1734a" data-node-id="2521:44740">
                    Escrow Allocation
                  </p>
                </div>
                <p
                  className="admin-element-aaa436472"
                  data-node-id="2521:44741"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Granular ledger breakdown of funds held under multi-sig vault protocol:
                </p>
                <div
                  className="admin-element-85fecde8d"
                  data-node-id="2521:44742"
                  data-name="Allocation bar"
                >
                  <div
                    className="admin-element-50775ff19"
                    data-node-id="2521:44743"
                    data-name="Farmer share"
                  />
                </div>
                <p
                  className="admin-element-4ca3fb38c"
                  data-node-id="2521:44744"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Farmer (89.8%) · Logistics (8.5%) · Margin (1.7%)
                </p>
                <div
                  className="admin-element-5efbae559"
                  data-node-id="2521:44745"
                  data-name="Farmer allocation"
                >
                  <div
                    className="admin-element-74f8ed970"
                    data-node-id="2521:44746"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    <p className="admin-element-96eff31b5">Farmer Allocation</p>
                    <p className="admin-element-a4d2b1ada">Chibuzor Simon (#FRM-4092)</p>
                  </div>
                  <p
                    className="admin-element-3a774838c"
                    data-node-id="2521:44747"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦32,000
                  </p>
                </div>
                <div
                  className="admin-element-5efbae559"
                  data-node-id="2521:44748"
                  data-name="Logistics allocation"
                >
                  <div
                    className="admin-element-74f8ed970"
                    data-node-id="2521:44749"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    <p className="admin-element-96eff31b5">Logistics Payout</p>
                    <p className="admin-element-a4d2b1ada">Chinedu Obi (Vehicle KJA-412-XA)</p>
                  </div>
                  <p
                    className="admin-element-3a774838c"
                    data-node-id="2521:44750"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦3,000
                  </p>
                </div>
                <div
                  className="admin-element-7590fded6"
                  data-node-id="2521:44751"
                  data-name="Marketplace margin"
                >
                  <div
                    className="admin-element-74808215b"
                    data-node-id="2521:44752"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    <p className="admin-element-96eff31b5">Leetlogic Margin</p>
                    <p className="admin-element-a4d2b1ada">Platform assurance fee (1.7%)</p>
                  </div>
                  <p
                    className="admin-element-a5327ca9a"
                    data-node-id="2521:44753"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ₦600
                  </p>
                </div>
                <div
                  className="admin-element-e8a2c639e"
                  data-node-id="2521:44754"
                  data-name="Escrow release policy"
                >
                  <p
                    className="admin-element-eeffe641c"
                    data-node-id="2521:44755"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Escrow Release Policy
                  </p>
                  <p
                    className="admin-element-f57c10294"
                    data-node-id="2521:44756"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Funds unlock upon 4-digit recipient OTP handshake or 24-hr auto-settlement post
                    geo-fenced depot delivery stamp.
                  </p>
                </div>
                <AdminControl
                  className="admin-element-4a9ad909c"
                  data-node-id="2521:44757"
                  data-name="Secondary action"
                >
                  <p
                    className="admin-element-ccf92a798"
                    data-node-id="2521:44758"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Put Escrow on Temporary Hold
                  </p>
                </AdminControl>
              </div>
            </div>
          </div>
          <div
            className="admin-element-89192ea12"
            data-node-id="2521:44759"
            data-name="Settlement window"
          >
            <p
              className="admin-element-ce940c4a8"
              data-node-id="2521:44760"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Settlement Window · T+1 Live
            </p>
            <p
              className="admin-element-57a4190ea"
              data-node-id="2521:44761"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Daily cut-off: 16:30 WAT
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
