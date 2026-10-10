import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgLeetlogicIcon = `${assetPathPrefix}/f4d0e.svg`;
const imgLayoutGrid01 = `${assetPathPrefix}/a643b.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/93749.svg`;
const imgArchive = `${assetPathPrefix}/d19a5.svg`;
const imgTruck = `${assetPathPrefix}/b8b77.svg`;
const imgShieldTick = `${assetPathPrefix}/6769f.svg`;
const imgSearch = `${assetPathPrefix}/8623b.svg`;
const imgBell = `${assetPathPrefix}/52a48.svg`;
const imgVector = `${assetPathPrefix}/f9ed5.svg`;
const imgScales02 = `${assetPathPrefix}/b6767.svg`;
export default function Component2601Roles() {
  return (
    <div className="admin-element-ed8971f7b" data-node-id="2521:45210" data-name="26.01 · Roles">
      <div
        className="admin-element-7302cdcad"
        data-node-id="2521:45211"
        data-name="Staff navigation"
      >
        <div
          className="admin-element-88cb7a7b8"
          data-node-id="2521:45212"
          data-name="Approved brand"
        >
          <div
            className="admin-element-2d3663d59"
            data-node-id="2521:45213"
            data-name="Leetlogic icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLeetlogicIcon} />
          </div>
          <p className="admin-element-0ead7d866" data-node-id="2521:45216">
            Leetlogic
          </p>
        </div>
        <p className="admin-element-1150e9f94" data-node-id="2521:45217">
          Operations
        </p>
        <div
          className="admin-element-109669e20"
          data-node-id="2521:45218"
          data-name="Staff identity"
        >
          <p className="admin-element-246542440" data-node-id="2521:45219">
            Amaka
          </p>
          <p className="admin-element-aed606b87" data-node-id="2521:45220">
            Operations Admin
          </p>
        </div>
        <div
          className="admin-element-c94ed62b9"
          data-node-id="2521:45221"
          data-name="Navigation items"
        >
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:45222"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45223"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <Link
              className="admin-element-ed5726f4c"
              data-node-id="2521:45224"
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:45225"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45226"
              data-name="check-verified-03"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
            </div>
            <Link
              className="admin-element-ed5726f4c"
              data-node-id="2521:45227"
              href="/admin/verification"
            >
              Verification Queue
            </Link>
          </div>
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:45228"
            data-name="Navigation item"
          >
            <div className="admin-element-b2a182ecf" data-node-id="2521:45229" data-name="archive">
              <img alt="" className="admin-element-8faf267d3" src={imgArchive} />
            </div>
            <Link
              className="admin-element-ed5726f4c"
              data-node-id="2521:45230"
              href="/admin/listings"
            >
              Listings
            </Link>
          </div>
          <Link
            className="admin-element-5301e7ea7"
            data-node-id="2521:45231"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-b2a182ecf" data-node-id="2521:45232" data-name="truck">
              <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
            </div>
            <span className="admin-element-ed5726f4c" data-node-id="2521:45233">
              Orders
            </span>
          </Link>
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:45234"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45235"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <Link className="admin-element-ed5726f4c" data-node-id="2521:45236" href="/admin/users">
              Users
            </Link>
          </div>
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:45237"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45238"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <Link
              className="admin-element-ed5726f4c"
              data-node-id="2521:45239"
              href="/admin/system"
            >
              System Status
            </Link>
          </div>
          <div
            className="admin-element-826a38a85"
            data-node-id="2521:45240"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45241"
              data-name="shield-tick"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgShieldTick} />
            </div>
            <Link className="admin-element-78d88db26" data-node-id="2521:45242" href="/admin/roles">
              Roles
            </Link>
          </div>
          <Link
            className="admin-element-5301e7ea7"
            data-node-id="2521:45243"
            data-name="Navigation item"
            href="/admin/faq"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45244"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <span
              className="admin-element-ed5726f4c"
              data-node-id="2521:45245"
            >{`FAQ & Content`}</span>
          </Link>
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:45246"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45247"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <Link className="admin-element-ed5726f4c" data-node-id="2521:45248" href="/admin/audit">
              Audit Logs
            </Link>
          </div>
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:45249"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:45250"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <Link
              className="admin-element-ed5726f4c"
              data-node-id="2521:45251"
              href="/admin/settings"
            >
              Settings
            </Link>
          </div>
        </div>
        <div
          className="admin-element-2858ff3cb"
          data-node-id="2521:45252"
          data-name="Portal utilities"
        >
          <p
            className="admin-element-b4b9ac434"
            data-node-id="2521:45253"
          >{`● Ops Portal v2.4   ♙`}</p>
        </div>
      </div>
      <div
        className="admin-element-37143800d"
        data-node-id="2521:45254"
        data-name="Permissions content"
      >
        <div
          className="admin-element-b5a1c5b2d"
          data-node-id="2521:45255"
          data-name="Workspace toolbar"
        >
          <div className="admin-element-58d29b27c" data-node-id="2521:45256" data-name="search">
            <img alt="" className="admin-element-8faf267d3" src={imgSearch} />
          </div>
          <p className="admin-element-ff5cb26cc" data-node-id="2521:45257">
            Search orders, farmers, commodities, or audit records...
          </p>
          <div
            className="admin-element-34d33d007"
            data-node-id="2521:45258"
            data-name="Status badge"
          >
            <div
              className="admin-element-f9034e18a"
              data-node-id="I2521:45258;1046:4838"
              data-name="_Badge base"
            >
              <p className="admin-element-157c991da" data-node-id="I2521:45258;1046:4838;1046:26">
                ● System Operational 99.98%
              </p>
            </div>
          </div>
          <div className="admin-element-58d29b27c" data-node-id="2521:45259" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
        </div>
        <div
          className="admin-element-b70651c68"
          data-node-id="2521:45260"
          data-name="Workspace heading"
        >
          <p
            className="admin-element-549b2c816"
            data-node-id="2521:45261"
          >{`IAM · Authorization Protocol   • Enforced across 25 staff seats`}</p>
          <p
            className="admin-element-f16f4615d"
            data-node-id="2521:45262"
          >{`Staff Roles & Access Permissions`}</p>
          <p className="admin-element-43aa1a7d4" data-node-id="2521:45263">
            Configure role boundaries, authorization tiers, and high-risk financial approval rights
            across Nigerian marketplace operations.
          </p>
          <div
            className="admin-element-0bab63b93"
            data-node-id="2521:45264"
            data-name="Workspace actions"
          >
            <AdminControl
              className="admin-element-651901cfc"
              data-node-id="2521:45265"
              data-name="Secondary action"
            >
              <p className="admin-element-ebef5a938" data-node-id="2521:45266">
                Export Permission Audit
              </p>
            </AdminControl>
            <AdminControl
              className="admin-element-5c99ef5f2"
              data-node-id="2521:45267"
              data-name="Primary action"
            >
              <div
                className="admin-element-4713e3706"
                data-node-id="I2521:45267;2521:20144"
                data-name="Button:shadow"
              />
              <div
                className="admin-element-902135774"
                data-node-id="I2521:45267;2521:20145"
                data-name="Container"
              >
                <div
                  className="admin-element-557ab447b"
                  data-node-id="I2521:45267;2521:20146"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  <p className="admin-element-f62dcabf0">Create Custom Role</p>
                </div>
              </div>
              <div
                className="admin-element-2dc9dba46"
                data-node-id="I2521:45267;2521:20147"
                data-name="SVG:margin"
              >
                <div
                  className="admin-element-71a1a822a"
                  data-node-id="I2521:45267;2521:20148"
                  data-name="SVG"
                >
                  <div
                    className="admin-element-ffa5f14fd"
                    data-node-id="I2521:45267;2521:20149"
                    data-name="SVG"
                  >
                    <div
                      className="admin-element-388053abb"
                      data-node-id="I2521:45267;2521:20150"
                      data-name="Vector"
                    >
                      <div className="admin-element-8085711b6">
                        <img alt="" className="admin-element-acc3667e9" src={imgVector} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AdminControl>
          </div>
        </div>
        <div
          className="admin-element-320438258"
          data-node-id="2521:45268"
          data-name="Governance policy"
        >
          <div
            className="admin-element-8da3d0308"
            data-node-id="2521:45269"
            data-name="Policy details"
          >
            <div
              className="admin-element-eaa60f1c4"
              data-node-id="2521:45270"
              data-name="scales-02"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgScales02} />
            </div>
            <div
              className="admin-element-cba405628"
              data-node-id="2521:45271"
              data-name="Policy copy"
            >
              <p className="admin-element-7c990ab74" data-node-id="2521:45272">
                Governance Policy #FIN-2024-NG · Strict Enforcement
              </p>
              <p
                className="admin-element-792987414"
                data-node-id="2521:45273"
              >{`High-risk operations (Escrow release, Manual bank refunds, Staff credential changes) require dual-factor authorization and are restricted strictly to Finance & Lead Operations.`}</p>
              <div
                className="admin-element-34d33d007"
                data-node-id="2521:45274"
                data-name="Status badge"
              >
                <div
                  className="admin-element-f9034e18a"
                  data-node-id="I2521:45274;1046:4838"
                  data-name="_Badge base"
                >
                  <p
                    className="admin-element-157c991da"
                    data-node-id="I2521:45274;1046:4838;1046:26"
                  >
                    2FA Enforcement: ✓ 100% Active
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="admin-element-5de13c3f8"
          data-node-id="2521:45275"
          data-name="Permission metrics"
        >
          <div
            className="admin-element-e08cc60c5"
            data-node-id="2521:45276"
            data-name="Permission metric"
          >
            <p className="admin-element-3a9ddf865" data-node-id="2521:45277">
              Total Defined Roles
            </p>
            <p className="admin-element-2d90c5ecf" data-node-id="2521:45278">
              4
            </p>
            <p className="admin-element-f363c32bc" data-node-id="2521:45279">
              Standard tiers
            </p>
          </div>
          <div
            className="admin-element-e08cc60c5"
            data-node-id="2521:45280"
            data-name="Permission metric"
          >
            <p className="admin-element-3a9ddf865" data-node-id="2521:45281">
              Active Staff Assigned
            </p>
            <p className="admin-element-2d90c5ecf" data-node-id="2521:45282">
              25
            </p>
            <p className="admin-element-f363c32bc" data-node-id="2521:45283">
              All cleared
            </p>
          </div>
          <div
            className="admin-element-e08cc60c5"
            data-node-id="2521:45284"
            data-name="Permission metric"
          >
            <p className="admin-element-3a9ddf865" data-node-id="2521:45285">
              Financial Threshold Cap
            </p>
            <p className="admin-element-2d90c5ecf" data-node-id="2521:45286">
              ₦10.0M
            </p>
            <p className="admin-element-f363c32bc" data-node-id="2521:45287">
              per batch
            </p>
          </div>
          <div
            className="admin-element-e08cc60c5"
            data-node-id="2521:45288"
            data-name="Permission metric"
          >
            <p className="admin-element-3a9ddf865" data-node-id="2521:45289">
              Last Permission Audit
            </p>
            <p className="admin-element-2d90c5ecf" data-node-id="2521:45290">
              Today
            </p>
            <p className="admin-element-f363c32bc" data-node-id="2521:45291">
              04:15 WAT
            </p>
          </div>
        </div>
        <div
          className="admin-element-67faeda4d"
          data-node-id="2521:45292"
          data-name="Role section heading"
        >
          <p className="admin-element-5a3e17788" data-node-id="2521:45293">
            Configured Role Definitions
          </p>
          <p className="admin-element-d9769a876" data-node-id="2521:45294">
            Arranged by risk privilege tier
          </p>
        </div>
        <div
          className="admin-element-13a6ee8df"
          data-node-id="2521:45295"
          data-name="Staff role and permission module"
        >
          <div
            className="admin-element-048b51150"
            data-node-id="2521:45296"
            data-name="Role header"
          >
            <p className="admin-element-eea966291" data-node-id="2521:45297">
              Finance
            </p>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:45298"
              data-name="Status badge"
            >
              <div
                className="admin-element-ee793de92"
                data-node-id="I2521:45298;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-a44c93087" data-node-id="I2521:45298;1046:4838;1046:26">
                  High-Risk Tier (Financial Authority)
                </p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-8bf62be33"
            data-node-id="2521:45299"
            data-name="Role definition"
          >
            <div
              className="admin-element-b107ca056"
              data-node-id="2521:45300"
              data-name="Authority and permissions"
            >
              <div
                className="admin-element-34d33d007"
                data-node-id="2521:45301"
                data-name="Status badge"
              >
                <div
                  className="admin-element-45367f628"
                  data-node-id="I2521:45301;1046:4838"
                  data-name="_Badge base"
                >
                  <p
                    className="admin-element-7222d49ee"
                    data-node-id="I2521:45301;1046:4838;1046:26"
                  >
                    Dual Authorization Required
                  </p>
                </div>
              </div>
              <p className="admin-element-26b06c4a8" data-node-id="2521:45302">
                Manages escrow reconciliation, bank settlement files, farmer payout releases, and
                payment gateway dispute arbitration.
              </p>
              <p
                className="admin-element-eb00a6706"
                data-node-id="2521:45303"
              >{`Key permissions & delegations`}</p>
              <div
                className="admin-element-57cd0aef2"
                data-node-id="2521:45304"
                data-name="Permission tags"
              >
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45305"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45305;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45305;1046:4838;1046:26"
                    >
                      ✓ Authorized to release withdrawals up to ₦10,000,000
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45306"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45306;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45306;1046:4838;1046:26"
                    >
                      ✓ Approve bulk refunds
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45307"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45307;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45307;1046:4838;1046:26"
                    >{`✓ View banking & settlement ledgers`}</p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45308"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45308;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45308;1046:4838;1046:26"
                    >
                      ✓ Audit merchant transactions
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-87b785346"
              data-node-id="2521:45309"
              data-name="Assigned staff"
            >
              <div
                className="admin-element-bac3d5a80"
                data-node-id="2521:45310"
                data-name="Member details"
              >
                <div
                  className="admin-element-c490d6ecc"
                  data-node-id="2521:45311"
                  data-name="Staff initials and count"
                >
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45312"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45313">
                      BA
                    </p>
                  </div>
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45314"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45315">
                      CO
                    </p>
                  </div>
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45316"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45317">
                      KA
                    </p>
                  </div>
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:45318">
                    3 Members
                  </p>
                </div>
                <p className="admin-element-15dd8776d" data-node-id="2521:45319">
                  Babatunde Adeleke, Chiamaka Okoli, Kemi Adeleke
                </p>
              </div>
              <div
                className="admin-element-b8fe2cb1d"
                data-node-id="2521:45320"
                data-name="Role actions"
              >
                <AdminControl
                  className="admin-element-ec984602d"
                  data-node-id="2521:45321"
                  data-name="View staff action"
                >
                  <p className="admin-element-4001af56f" data-node-id="2521:45322">
                    ◉ View 3 Staff
                  </p>
                </AdminControl>
                <AdminControl
                  className="admin-element-6ea78c079"
                  data-node-id="2521:45323"
                  data-name="Edit role action"
                >
                  <p className="admin-element-b01a20783" data-node-id="2521:45324">
                    ✎ Edit Role
                  </p>
                </AdminControl>
              </div>
            </div>
          </div>
        </div>
        <div
          className="admin-element-13a6ee8df"
          data-node-id="2521:45325"
          data-name="Staff role and permission module"
        >
          <div
            className="admin-element-048b51150"
            data-node-id="2521:45326"
            data-name="Role header"
          >
            <Link
              className="admin-element-eea966291"
              data-node-id="2521:45327"
              href="/admin/verification"
            >
              Verification
            </Link>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:45328"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:45328;1046:4838"
                data-name="_Badge base"
              >
                <p
                  className="admin-element-7222d49ee"
                  data-node-id="I2521:45328;1046:4838;1046:26"
                >{`Compliance & Identity Field`}</p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-8bf62be33"
            data-node-id="2521:45329"
            data-name="Role definition"
          >
            <div
              className="admin-element-b107ca056"
              data-node-id="2521:45330"
              data-name="Authority and permissions"
            >
              <p className="admin-element-43aa1a7d4" data-node-id="2521:45331">
                Validates farmer identity documents (NIN, INEC PVC, Driver License), conducts selfie
                liveness matching, and confirms farm acreage geofencing.
              </p>
              <p
                className="admin-element-3ab21a8ea"
                data-node-id="2521:45332"
              >{`Key permissions & delegations`}</p>
              <div
                className="admin-element-57cd0aef2"
                data-node-id="2521:45333"
                data-name="Permission tags"
              >
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45334"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45334;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45334;1046:4838;1046:26"
                    >{`✓ Verify farmer & buyer accounts`}</p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45335"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45335;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45335;1046:4838;1046:26"
                    >
                      ✓ Request ID retakes
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45336"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45336;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45336;1046:4838;1046:26"
                    >
                      ✓ Approve produce listing quality
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45337"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-45367f628"
                    data-node-id="I2521:45337;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-7222d49ee"
                      data-node-id="I2521:45337;1046:4838;1046:26"
                    >
                      ⊘ Release withdrawals (Restricted)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-87b785346"
              data-node-id="2521:45338"
              data-name="Assigned staff"
            >
              <div
                className="admin-element-bac3d5a80"
                data-node-id="2521:45339"
                data-name="Member details"
              >
                <div
                  className="admin-element-c490d6ecc"
                  data-node-id="2521:45340"
                  data-name="Staff initials and count"
                >
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45341"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45342">
                      AO
                    </p>
                  </div>
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45343"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45344">
                      IM
                    </p>
                  </div>
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45345"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45346">
                      +5
                    </p>
                  </div>
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:45347">
                    8 Members
                  </p>
                </div>
                <p className="admin-element-15dd8776d" data-node-id="2521:45348">
                  Amaka Okonkwo, Ibrahim Musa, Chinwe Obi + 5 more
                </p>
              </div>
              <div
                className="admin-element-b8fe2cb1d"
                data-node-id="2521:45349"
                data-name="Role actions"
              >
                <AdminControl
                  className="admin-element-ec984602d"
                  data-node-id="2521:45350"
                  data-name="View staff action"
                >
                  <p className="admin-element-4001af56f" data-node-id="2521:45351">
                    ◉ View 8 Staff
                  </p>
                </AdminControl>
                <AdminControl
                  className="admin-element-6ea78c079"
                  data-node-id="2521:45352"
                  data-name="Edit role action"
                >
                  <p className="admin-element-b01a20783" data-node-id="2521:45353">
                    ✎ Edit Role
                  </p>
                </AdminControl>
              </div>
            </div>
          </div>
        </div>
        <div
          className="admin-element-13a6ee8df"
          data-node-id="2521:45354"
          data-name="Staff role and permission module"
        >
          <div
            className="admin-element-048b51150"
            data-node-id="2521:45355"
            data-name="Role header"
          >
            <Link
              className="admin-element-eea966291"
              data-node-id="2521:45356"
              href="/admin/support"
            >
              Support
            </Link>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:45357"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:45357;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-7222d49ee" data-node-id="I2521:45357;1046:4838;1046:26">
                  Frontline Operations
                </p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-8bf62be33"
            data-node-id="2521:45358"
            data-name="Role definition"
          >
            <div
              className="admin-element-b107ca056"
              data-node-id="2521:45359"
              data-name="Authority and permissions"
            >
              <p className="admin-element-43aa1a7d4" data-node-id="2521:45360">
                Frontline customer service, live dispute triage, telephone callbacks, and agent
                ticket handling for farmers and buyers.
              </p>
              <p
                className="admin-element-3ab21a8ea"
                data-node-id="2521:45361"
              >{`Key permissions & delegations`}</p>
              <div
                className="admin-element-57cd0aef2"
                data-node-id="2521:45362"
                data-name="Permission tags"
              >
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45363"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45363;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45363;1046:4838;1046:26"
                    >{`✓ Respond to support tickets & live chat`}</p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45364"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45364;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45364;1046:4838;1046:26"
                    >
                      ✓ Flag orders for fraud investigation
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45365"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45365;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45365;1046:4838;1046:26"
                    >{`✓ View order tracking & shipping details`}</p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45366"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-45367f628"
                    data-node-id="I2521:45366;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-7222d49ee"
                      data-node-id="I2521:45366;1046:4838;1046:26"
                    >
                      ⊘ Release withdrawals
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45367"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-45367f628"
                    data-node-id="I2521:45367;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-7222d49ee"
                      data-node-id="I2521:45367;1046:4838;1046:26"
                    >
                      ⊘ Approve KYC
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-87b785346"
              data-node-id="2521:45368"
              data-name="Assigned staff"
            >
              <div
                className="admin-element-bac3d5a80"
                data-node-id="2521:45369"
                data-name="Member details"
              >
                <div
                  className="admin-element-c490d6ecc"
                  data-node-id="2521:45370"
                  data-name="Staff initials and count"
                >
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45371"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45372">
                      FU
                    </p>
                  </div>
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45373"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45374">
                      VA
                    </p>
                  </div>
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45375"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45376">
                      +9
                    </p>
                  </div>
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:45377">
                    12 Members
                  </p>
                </div>
                <p className="admin-element-15dd8776d" data-node-id="2521:45378">
                  Fatima Umar, Victor Adebayo, Emeka Nnamdi + 9 more
                </p>
              </div>
              <div
                className="admin-element-b8fe2cb1d"
                data-node-id="2521:45379"
                data-name="Role actions"
              >
                <AdminControl
                  className="admin-element-ec984602d"
                  data-node-id="2521:45380"
                  data-name="View staff action"
                >
                  <p className="admin-element-4001af56f" data-node-id="2521:45381">
                    ◉ View 12 Staff
                  </p>
                </AdminControl>
                <AdminControl
                  className="admin-element-6ea78c079"
                  data-node-id="2521:45382"
                  data-name="Edit role action"
                >
                  <p className="admin-element-b01a20783" data-node-id="2521:45383">
                    ✎ Edit Role
                  </p>
                </AdminControl>
              </div>
            </div>
          </div>
        </div>
        <div
          className="admin-element-13a6ee8df"
          data-node-id="2521:45384"
          data-name="Staff role and permission module"
        >
          <div
            className="admin-element-048b51150"
            data-node-id="2521:45385"
            data-name="Role header"
          >
            <p className="admin-element-eea966291" data-node-id="2521:45386">
              Super Admin
            </p>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:45387"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:45387;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-7222d49ee" data-node-id="I2521:45387;1046:4838;1046:26">
                  Root System Controller
                </p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-8bf62be33"
            data-node-id="2521:45388"
            data-name="Role definition"
          >
            <div
              className="admin-element-b107ca056"
              data-node-id="2521:45389"
              data-name="Authority and permissions"
            >
              <p className="admin-element-43aa1a7d4" data-node-id="2521:45390">
                Full administrative control, database configuration, security logs, and role
                assignment.
              </p>
              <p
                className="admin-element-3ab21a8ea"
                data-node-id="2521:45391"
              >{`Key permissions & delegations`}</p>
              <div
                className="admin-element-57cd0aef2"
                data-node-id="2521:45392"
                data-name="Permission tags"
              >
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45393"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45393;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45393;1046:4838;1046:26"
                    >{`✓ Full System Access & Override Rights`}</p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45394"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45394;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45394;1046:4838;1046:26"
                    >
                      ✓ Revoke Staff Credentials
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-34d33d007"
                  data-node-id="2521:45395"
                  data-name="Status badge"
                >
                  <div
                    className="admin-element-f9034e18a"
                    data-node-id="I2521:45395;1046:4838"
                    data-name="_Badge base"
                  >
                    <p
                      className="admin-element-157c991da"
                      data-node-id="I2521:45395;1046:4838;1046:26"
                    >
                      ✓ Export Audit Raw Vault
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-87b785346"
              data-node-id="2521:45396"
              data-name="Assigned staff"
            >
              <div
                className="admin-element-bac3d5a80"
                data-node-id="2521:45397"
                data-name="Member details"
              >
                <div
                  className="admin-element-c490d6ecc"
                  data-node-id="2521:45398"
                  data-name="Staff initials and count"
                >
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45399"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45400">
                      SL
                    </p>
                  </div>
                  <div
                    className="admin-element-813c9db11"
                    data-node-id="2521:45401"
                    data-name="Staff avatar"
                  >
                    <p className="admin-element-c68b179f8" data-node-id="2521:45402">
                      CT
                    </p>
                  </div>
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:45403">
                    2 Members
                  </p>
                </div>
                <p
                  className="admin-element-15dd8776d"
                  data-node-id="2521:45404"
                >{`System Lead & CTO`}</p>
              </div>
              <div
                className="admin-element-b8fe2cb1d"
                data-node-id="2521:45405"
                data-name="Role actions"
              >
                <AdminControl
                  className="admin-element-ec984602d"
                  data-node-id="2521:45406"
                  data-name="View staff action"
                >
                  <p className="admin-element-4001af56f" data-node-id="2521:45407">
                    ◉ View 2 Staff
                  </p>
                </AdminControl>
                <AdminControl
                  className="admin-element-ec984602d"
                  data-node-id="2521:45408"
                  data-name="Edit role action"
                >
                  <p className="admin-element-d225c0f22" data-node-id="2521:45409">
                    ♙ Protected Role
                  </p>
                </AdminControl>
              </div>
            </div>
          </div>
        </div>
        <div
          className="admin-element-c1dc7ada4"
          data-node-id="2521:45410"
          data-name="RBAC permission matrix"
        >
          <div
            className="admin-element-9a5e76aab"
            data-node-id="2521:45411"
            data-name="Matrix heading"
          >
            <div
              className="admin-element-d3594aa9f"
              data-node-id="2521:45412"
              data-name="Matrix title"
            >
              <p className="admin-element-6b19adfac" data-node-id="2521:45413">
                RBAC Permission Matrix
              </p>
              <p className="admin-element-44c296f88" data-node-id="2521:45414">
                Cross-functional verification across high-impact platform operations
              </p>
            </div>
            <p
              className="admin-element-1ef2df855"
              data-node-id="2521:45415"
            >{`✓ Granted   − Restricted`}</p>
          </div>
          <div
            className="admin-element-dfe84fd10"
            data-node-id="2521:45416"
            data-name="Permission matrix table"
          >
            <div
              className="admin-element-704252aea"
              data-node-id="I2521:45416;1227:108549"
              data-name="Content"
            >
              <div
                className="admin-element-6a3ecd723"
                data-node-id="I2521:45416;1225:108376"
                data-name="Column"
              >
                <div
                  className="admin-element-d65fbd0f7"
                  data-node-id="I2521:45416;1224:5566"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-e8210ba62"
                    data-node-id="I2521:45416;1224:5566;1221:107935"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:45416;1224:5566;1221:107935;1221:106781"
                    >
                      System Operation
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108334"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-a7233647c"
                    data-node-id="I2521:45416;1225:108334;1223:41"
                  >
                    <p className="admin-element-71f637913">Release Escrow</p>
                    <p className="admin-element-71f637913">Authorize NIBSS/Interswitch</p>
                    <p className="admin-element-76aad9ca0">transfer to seller</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108388"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-a7233647c"
                    data-node-id="I2521:45416;1225:108388;1223:41"
                  >
                    <p className="admin-element-71f637913">Verify ID (NIN / PVC / CAC)</p>
                    <p className="admin-element-71f637913">Liveness check and government</p>
                    <p className="admin-element-76aad9ca0">database verification</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:1"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-a7233647c"
                    data-node-id="I2521:45416;1226:1;1223:41"
                  >
                    <p className="admin-element-71f637913">{`Edit FAQ & Knowledge Base`}</p>
                    <p className="admin-element-71f637913">Modify public help center content</p>
                    <p className="admin-element-76aad9ca0">and crop calendars</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:9"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-a7233647c"
                    data-node-id="I2521:45416;1226:9;1223:41"
                  >
                    <p className="admin-element-71f637913">Suspend User / Merchant Freeze</p>
                    <p className="admin-element-71f637913">Temporary freeze of trading or</p>
                    <p className="admin-element-76aad9ca0">instant dispute quarantine</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:17"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-a7233647c"
                    data-node-id="I2521:45416;1226:17;1223:41"
                  >
                    <p className="admin-element-71f637913">Access Production Database</p>
                    <p className="admin-element-71f637913">Direct SQL access, replication</p>
                    <p className="admin-element-76aad9ca0">clusters, and migration keys</p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:45416;1225:108377"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:45416;1224:5575"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-3536005f7"
                    data-node-id="I2521:45416;1224:5575;1224:4551"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:45416;1224:5575;1224:4551;1221:106889"
                    >
                      Finance
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108335"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1225:108335;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1227:122229"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1227:122229;1223:41"
                  >
                    −
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1227:122235"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1227:122235;1223:41"
                  >
                    −
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1227:122241"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1227:122241;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1227:122247"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1227:122247;1223:41"
                  >
                    −
                  </p>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:45416;1225:108378"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:45416;1224:5797"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-3536005f7"
                    data-node-id="I2521:45416;1224:5797;1224:4551"
                    data-name="Table header"
                  >
                    <Link
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:45416;1224:5797;1224:4551;1221:106790"
                      href="/admin/verification"
                    >
                      Verification
                    </Link>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108336"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1225:108336;1223:41"
                  >
                    −
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108402"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1225:108402;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:164"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:164;1223:41"
                  >
                    −
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:166"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:166;1223:41"
                  >
                    −
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:168"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:168;1223:41"
                  >
                    −
                  </p>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:45416;1225:108385"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:45416;1224:5800"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-e8210ba62"
                    data-node-id="I2521:45416;1224:5800;1224:4551"
                    data-name="Table header"
                  >
                    <Link
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:45416;1224:5800;1224:4551;1221:106781"
                      href="/admin/support"
                    >
                      Support
                    </Link>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108337"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1225:108337;1223:41"
                  >
                    −
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108404"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1225:108404;1223:41"
                  >
                    −
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:188"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:188;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:190"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:190;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:192"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:192;1223:41"
                  >
                    −
                  </p>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:45416;1225:108386"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:45416;1224:5850"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-e8210ba62"
                    data-node-id="I2521:45416;1224:5850;1224:4551"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:45416;1224:5850;1224:4551;1221:106781"
                    >
                      Super Admin
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1225:108338"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1225:108338;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:216"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:216;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:232"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:232;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:248"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:248;1223:41"
                  >
                    ✓
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:45416;1226:264"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:45416;1226:264;1223:41"
                  >
                    ✓
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-1cdd01654"
            data-node-id="2521:45417"
            data-name="Matrix footnote"
          >
            <p className="admin-element-624a4eb9d" data-node-id="2521:45418">
              Matrix adjustments update immediately on next active staff session refresh.
            </p>
            <p className="admin-element-67fb73f59" data-node-id="2521:45419">
              Review Audit Log for Role Changes →
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
