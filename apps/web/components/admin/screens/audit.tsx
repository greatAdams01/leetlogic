import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgBotanicalMark = `${assetPathPrefix}/5ed8c.svg`;
const imgWordmark = `${assetPathPrefix}/0ad4c.svg`;
const imgAward = `${assetPathPrefix}/6dbaa.svg`;
export default function Component2901AuditLogSystemActivityTrail() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:46042"
      data-name="29.01 · Audit log & system activity trail"
    >
      <div className="admin-element-21a7647c1" data-node-id="2521:46043" data-name="Staff sidebar">
        <div
          className="admin-element-4fc05b874"
          data-node-id="2521:46044"
          data-name="Approved LeetLogic artwork"
        >
          <div
            className="admin-element-f84de7678"
            data-node-id="2521:46045"
            data-name="Botanical mark"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgBotanicalMark} />
          </div>
          <div className="admin-element-0cf7a046e" data-node-id="2521:46048" data-name="Wordmark">
            <img alt="" className="admin-element-8faf267d3" src={imgWordmark} />
          </div>
        </div>
        <p className="admin-element-1150e9f94" data-node-id="2521:46058">
          Operations portal
        </p>
        <div className="admin-element-ce079391e" data-node-id="2521:46059" data-name="Card">
          <p className="admin-element-1bc30747f" data-node-id="2521:46060">
            Amaka O.
          </p>
          <p
            className="admin-element-68e7d3268"
            data-node-id="2521:46061"
          >{`Operations & Finance`}</p>
        </div>
        <Link className="admin-element-f9528d997" data-node-id="2521:46062" href="/admin/dashboard">
          Dashboard
        </Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:46063"
          href="/admin/verification"
        >
          Verification Queue
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:46064" href="/admin/listings">
          Listings Queue
        </Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:46065"
          href="/admin/orders"
        >{`Orders & Escrow`}</Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:46066"
          href="/admin/reconciliation"
        >
          Reconciliation
        </Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:46067"
          href="/admin/withdrawals"
        >
          Withdrawals
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:46068" href="/admin/disputes">
          Dispute Queue
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:46069" href="/admin/users">
          Users
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:46070" href="/admin/audit">
          Audit Logs
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:46071" href="/admin/settings">
          Settings
        </Link>
        <p className="admin-element-1150e9f94" data-node-id="2521:46072">
          ● Ops Portal v2.4
        </p>
      </div>
      <div className="admin-element-2cccba0c3" data-node-id="2521:46073" data-name="Workspace">
        <div
          className="admin-element-bfa73d2c9"
          data-node-id="2521:46074"
          data-name="Staff toolbar"
        >
          <AdminField
            className="admin-element-79d519193"
            data-node-id="2521:46075"
            label="Search trade ref, seller ID, bank transaction..."
            search
          />
          <div
            className="admin-element-254931561"
            data-node-id="2521:46076"
            data-name="Status badge"
          >
            <p className="admin-element-649c0eb87" data-node-id="2521:46077">
              ● System Live
            </p>
          </div>
          <div
            className="admin-element-254931561"
            data-node-id="2521:46078"
            data-name="Status badge"
          >
            <p className="admin-element-649c0eb87" data-node-id="2521:46079">
              Lagos DC: 28ms
            </p>
          </div>
          <p className="admin-element-20d1cfadc" data-node-id="2521:46080">
            Amaka
          </p>
        </div>
        <div
          className="admin-element-255a14783"
          data-node-id="2521:46081"
          data-name="Workspace content"
        >
          <p className="admin-element-1a9fb554e" data-node-id="2521:46082">
            LeetLogic Operations
          </p>
          <p
            className="admin-element-8d85a98fe"
            data-node-id="2521:46083"
          >{`Audit log & system activity trail`}</p>
          <div
            className="admin-element-254931561"
            data-node-id="2521:46084"
            data-name="Status badge"
          >
            <p className="admin-element-649c0eb87" data-node-id="2521:46085">
              Immutable ledger · Append only
            </p>
          </div>
          <p className="admin-element-792987414" data-node-id="2521:46086">
            Immutable historical log of all staff verification actions, payment approvals, and
            permission changes across regional clusters.
          </p>
          <p className="admin-element-792987414" data-node-id="2521:46087">
            Export CSV log · Live sync
          </p>
          <div className="admin-element-8e0c3fcb5" data-node-id="2521:46088" data-name="Card">
            <AdminField
              className="admin-element-67366dcb7"
              data-node-id="2521:46089"
              label="Search by entity ID, staff, farmer name · Staff: All staff · Today (24 Oct 2024) · Live stream"
              search
            />
            <p
              className="admin-element-67366dcb7"
              data-node-id="2521:46090"
            >{`Event type: All events · KYC & verification · Financial / escrow · Account status · System settings`}</p>
          </div>
          <div className="admin-element-a98cc3994" data-node-id="2521:46091" data-name="Card">
            <div
              className="admin-element-254931561"
              data-node-id="2521:46092"
              data-name="Status badge"
            >
              <p className="admin-element-649c0eb87" data-node-id="2521:46093">
                Latest live action · Today · 2:14 PM (18 mins ago) · Cluster: Ebonyi / Abakaliki
              </p>
            </div>
            <p className="admin-element-5bfbcad78" data-node-id="2521:46094">
              Amaka Okonkwo · Tier 2 Ops Admin
            </p>
            <p className="admin-element-792987414" data-node-id="2521:46095">
              Verification clearance desk
            </p>
            <p className="admin-element-792987414" data-node-id="2521:46096">
              Farmer verified · Chibuzor Simon (#FRM-4092)
            </p>
            <p className="admin-element-792987414" data-node-id="2521:46097">
              Amaka verified Chibuzor Simon (#FRM-4092). INEC PVC validated with 94% facial match
              confidence. Produce listing rights unlocked for Abakaliki cluster.
            </p>
            <div
              className="admin-element-6b673ea9e"
              data-node-id="2521:46098"
              data-name="Assurance notice"
            >
              <div
                className="admin-element-73f1ccf97"
                data-node-id="I2521:46098;1:35387"
                data-name="Round-the-clock assurance"
              >
                <div
                  className="admin-element-b2a182ecf"
                  data-node-id="I2521:46098;1:35388"
                  data-name="award"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgAward} />
                </div>
                <p
                  className="admin-element-b9d807948"
                  data-node-id="I2521:46098;1:35389"
                >{`Security & origin trace`}</p>
              </div>
              <p className="admin-element-47958bf06" data-node-id="I2521:46098;1:35390">
                102.89.43.12 (Lagos Operations Center) · Verified via hardware 2FA token
              </p>
            </div>
            <AdminControl
              className="admin-element-2bb850639"
              data-node-id="2521:46099"
              data-name="Action"
            >
              <div
                className="admin-element-4713e3706"
                data-node-id="I2521:46099;1:33891"
                data-name="Button:shadow"
              />
              <div
                className="admin-element-9a39a55c2"
                data-node-id="I2521:46099;1:33892"
                data-name="Container"
              >
                <div className="admin-element-995c66ea7" data-node-id="I2521:46099;1:33893">
                  <p className="admin-element-f62dcabf0">Inspect payload</p>
                </div>
              </div>
            </AdminControl>
          </div>
          <div className="admin-element-a98cc3994" data-node-id="2521:46100" data-name="Card">
            <p className="admin-element-a0f4dbc4c" data-node-id="2521:46101">
              Sequential audit records
            </p>
            <p className="admin-element-82438c881" data-node-id="2521:46102">
              Chain block #921,804 · Encrypted SHA-256 state verified
            </p>
            <div
              className="admin-element-fcb092753"
              data-node-id="2521:46103"
              data-name="Records table"
            >
              <div
                className="admin-element-985cf802b"
                data-node-id="2521:46104"
                data-name="Column headings"
              >
                <p className="admin-element-4a9b73a3b" data-node-id="2521:46105">
                  Timestamp
                </p>
                <p className="admin-element-4a9b73a3b" data-node-id="2521:46106">
                  Actor
                </p>
                <p className="admin-element-4a9b73a3b" data-node-id="2521:46107">
                  Event type
                </p>
                <p className="admin-element-4a9b73a3b" data-node-id="2521:46108">
                  Target entity
                </p>
                <p className="admin-element-4a9b73a3b" data-node-id="2521:46109">
                  Description / reason
                </p>
              </div>
              <div className="admin-element-896e3cc2e" data-node-id="2521:46110" data-name="Record">
                <div
                  className="admin-element-40ee1bfc7"
                  data-node-id="2521:46111"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46111;1223:41">
                    <p className="admin-element-9a41b2470">Today · 1:52 PM</p>
                    <p className="admin-element-efcc9af6d">40 mins ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-40ee1bfc7"
                  data-node-id="2521:46112"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46112;1223:41">
                    <p className="admin-element-9a41b2470">Babatunde Adeleke</p>
                    <p className="admin-element-efcc9af6d">Finance Officer</p>
                  </div>
                </div>
                <div
                  className="admin-element-40ee1bfc7"
                  data-node-id="2521:46113"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46113;1223:41">
                    Withdrawal released
                  </p>
                </div>
                <div
                  className="admin-element-40ee1bfc7"
                  data-node-id="2521:46114"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46114;1223:41">
                    <p className="admin-element-9a41b2470">Chibuzor Simon</p>
                    <p className="admin-element-efcc9af6d">#FRM-4092</p>
                  </div>
                </div>
                <div
                  className="admin-element-40ee1bfc7"
                  data-node-id="2521:46115"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46115;1223:41">
                    Released escrow payout of ₦20,000 to Chibuzor Simon via Opay wallet.
                  </p>
                </div>
              </div>
              <div className="admin-element-896e3cc2e" data-node-id="2521:46116" data-name="Record">
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46117"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46117;1223:41">
                    <p className="admin-element-9a41b2470">Today · 1:28 PM</p>
                    <p className="admin-element-efcc9af6d">1 hr 4 mins ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46118"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46118;1223:41">
                    <p className="admin-element-9a41b2470">Amaka Okonkwo</p>
                    <p className="admin-element-efcc9af6d">Tier 2 Ops Admin</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46119"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46119;1223:41">
                    Retake requested
                  </p>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46120"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46120;1223:41">
                    <p className="admin-element-9a41b2470">Blessing Nwachukwu</p>
                    <p className="admin-element-efcc9af6d">#FRM-5012</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46121"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46121;1223:41">
                    Requested ID retake. Reason: blurry INEC card edge.
                  </p>
                </div>
              </div>
              <div className="admin-element-896e3cc2e" data-node-id="2521:46122" data-name="Record">
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46123"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46123;1223:41">
                    <p className="admin-element-9a41b2470">Today · 12:45 PM</p>
                    <p className="admin-element-efcc9af6d">1 hr 47 mins ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46124"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46124;1223:41">
                    <p className="admin-element-9a41b2470">System Admin</p>
                    <p className="admin-element-efcc9af6d">Automated Daemon</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46125"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46125;1223:41">
                    Status changed
                  </p>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46126"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46126;1223:41">
                    <p className="admin-element-9a41b2470">NIBSS Gateway</p>
                    <p className="admin-element-efcc9af6d">#SYS-PAY</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46127"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46127;1223:41">
                    Payment service toggled DOWN due to upstream latency. Public app notice posted.
                  </p>
                </div>
              </div>
              <div className="admin-element-896e3cc2e" data-node-id="2521:46128" data-name="Record">
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46129"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46129;1223:41">
                    <p className="admin-element-9a41b2470">Today · 11:30 AM</p>
                    <p className="admin-element-efcc9af6d">3 hrs ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46130"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46130;1223:41">
                    <p className="admin-element-9a41b2470">Amaka Okonkwo</p>
                    <p className="admin-element-efcc9af6d">Tier 2 Ops Admin</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46131"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46131;1223:41">
                    User suspended
                  </p>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46132"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46132;1223:41">
                    <p className="admin-element-9a41b2470">Tunde Balogun</p>
                    <p className="admin-element-efcc9af6d">#BUY-1049</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46133"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46133;1223:41">
                    Suspended buyer following fraud alert: off-app transfer solicitation.
                  </p>
                </div>
              </div>
              <div className="admin-element-896e3cc2e" data-node-id="2521:46134" data-name="Record">
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46135"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46135;1223:41">
                    <p className="admin-element-9a41b2470">Today · 10:15 AM</p>
                    <p className="admin-element-efcc9af6d">4 hrs ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46136"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46136;1223:41">
                    <p className="admin-element-9a41b2470">Fatima Umar</p>
                    <p className="admin-element-efcc9af6d">Support Officer</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46137"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46137;1223:41">
                    Dispute escalated
                  </p>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46138"
                  data-name="Record value"
                >
                  <div className="admin-element-c46571178" data-node-id="I2521:46138;1223:41">
                    <p className="admin-element-9a41b2470">Order #ORD-7729</p>
                    <p className="admin-element-efcc9af6d">Roma Tomatoes</p>
                  </div>
                </div>
                <div
                  className="admin-element-ee5c69f9a"
                  data-node-id="2521:46139"
                  data-name="Record value"
                >
                  <p className="admin-element-d7c972209" data-node-id="I2521:46139;1223:41">
                    Escalated Ticket #2041 (Damaged Roma Tomatoes) to Senior Dispute Arbitrator.
                  </p>
                </div>
              </div>
            </div>
            <p className="admin-element-82438c881" data-node-id="2521:46140">
              Showing 6 of 842 audit records · Page 1 of 141 · Previous 1 2 3 ... 141 Next
            </p>
          </div>
          <div
            className="admin-element-b13473824"
            data-node-id="2521:46141"
            data-name="Compliance metrics"
          >
            <div className="admin-element-f3950063d" data-node-id="2521:46142" data-name="Card">
              <p className="admin-element-82438c881" data-node-id="2521:46143">
                99.98% · Compliance verification index
              </p>
            </div>
            <div className="admin-element-f3950063d" data-node-id="2521:46144" data-name="Card">
              <p className="admin-element-82438c881" data-node-id="2521:46145">
                100% 2FA · Staff authentication enforced
              </p>
            </div>
            <div className="admin-element-f3950063d" data-node-id="2521:46146" data-name="Card">
              <p className="admin-element-82438c881" data-node-id="2521:46147">
                7 years · Statutory data retention lock
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
