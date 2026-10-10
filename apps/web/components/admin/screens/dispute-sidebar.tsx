import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgLeetlogicIcon = `${assetPathPrefix}/d514d.svg`;
const imgShieldTick = `${assetPathPrefix}/4f8a4.svg`;
const imgLayoutAlt01 = `${assetPathPrefix}/72c31.svg`;
const imgWallet04 = `${assetPathPrefix}/489b4.svg`;
const imgReceipt = `${assetPathPrefix}/814ec.svg`;
const imgBankNote01 = `${assetPathPrefix}/9c222.svg`;
const imgScales02 = `${assetPathPrefix}/f6062.svg`;
const imgVerified = `${assetPathPrefix}/a1d35.svg`;
export default function StaffSidebar() {
  return (
    <div className="admin-element-fe9168652" data-node-id="2521:43355" data-name="Staff sidebar">
      <div
        className="admin-element-c427675f0"
        data-node-id="2521:43356"
        data-name="Portal identity"
      >
        <div
          className="admin-element-75f2c6b5a"
          data-node-id="2521:43357"
          data-name="Leetlogic icon"
        >
          <img alt="" className="admin-element-8faf267d3" src={imgLeetlogicIcon} />
        </div>
        <div className="admin-element-553d839e9" data-node-id="2521:43360" data-name="Brand">
          <p className="admin-element-b3de10e69" data-node-id="2521:43361">
            Leetlogic
          </p>
          <p className="admin-element-2ac3dae21" data-node-id="2521:43362">
            OPS PORTAL
          </p>
        </div>
        <div className="admin-element-5c0da5112" data-node-id="2521:43363" data-name="Badge">
          <p className="admin-element-978a32b3a" data-node-id="2521:43364">
            ● HQ
          </p>
        </div>
      </div>
      <div className="admin-element-79d589f2d" data-node-id="2521:43365" data-name="Staff identity">
        <div
          className="admin-element-590f17ea6"
          data-node-id="2521:43366"
          data-name="Initial avatar"
        >
          <p className="admin-element-3310688a3" data-node-id="2521:43367">
            A
          </p>
        </div>
        <div className="admin-element-9cc521461" data-node-id="2521:43368" data-name="Officer">
          <p className="admin-element-dc23f7e26" data-node-id="2521:43369">
            Amaka O.
          </p>
          <p
            className="admin-element-338de0692"
            data-node-id="2521:43370"
          >{`Operations & Finance`}</p>
        </div>
        <div className="admin-element-c51752dc8" data-node-id="2521:43371" data-name="shield-tick">
          <img alt="" className="admin-element-8faf267d3" src={imgShieldTick} />
        </div>
      </div>
      <div
        className="admin-element-c94ed62b9"
        data-node-id="2521:43372"
        data-name="Staff navigation"
      >
        <div
          className="admin-element-f6e1b4904"
          data-node-id="2521:43373"
          data-name="Sidebar navigation item"
        >
          <div
            className="admin-element-b2a182ecf"
            data-node-id="2521:43374"
            data-name="layout-alt-01"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLayoutAlt01} />
          </div>
          <Link
            className="admin-element-47b0da21e"
            data-node-id="2521:43375"
            href="/admin/dashboard"
          >
            Dashboard
          </Link>
        </div>
        <div
          className="admin-element-f6e1b4904"
          data-node-id="2521:43376"
          data-name="Sidebar navigation item"
        >
          <div className="admin-element-b2a182ecf" data-node-id="2521:43377" data-name="wallet-04">
            <img alt="" className="admin-element-8faf267d3" src={imgWallet04} />
          </div>
          <Link
            className="admin-element-47b0da21e"
            data-node-id="2521:43378"
            href="/admin/orders"
          >{`Orders & Escrow`}</Link>
        </div>
        <div
          className="admin-element-f6e1b4904"
          data-node-id="2521:43379"
          data-name="Sidebar navigation item"
        >
          <div className="admin-element-b2a182ecf" data-node-id="2521:43380" data-name="receipt">
            <img alt="" className="admin-element-8faf267d3" src={imgReceipt} />
          </div>
          <Link
            className="admin-element-47b0da21e"
            data-node-id="2521:43381"
            href="/admin/reconciliation"
          >
            Reconciliation
          </Link>
        </div>
        <div
          className="admin-element-f6e1b4904"
          data-node-id="2521:43382"
          data-name="Sidebar navigation item"
        >
          <div
            className="admin-element-b2a182ecf"
            data-node-id="2521:43383"
            data-name="bank-note-01"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgBankNote01} />
          </div>
          <Link
            className="admin-element-47b0da21e"
            data-node-id="2521:43384"
            href="/admin/withdrawals"
          >
            Withdrawals
          </Link>
        </div>
        <div
          className="admin-element-37a6f72e9"
          data-node-id="2521:43385"
          data-name="Sidebar navigation item"
        >
          <div className="admin-element-b2a182ecf" data-node-id="2521:43386" data-name="scales-02">
            <img alt="" className="admin-element-8faf267d3" src={imgScales02} />
          </div>
          <Link
            className="admin-element-47b0da21e"
            data-node-id="2521:43387"
            href="/admin/disputes"
          >
            Dispute Queue
          </Link>
        </div>
        <div
          className="admin-element-f6e1b4904"
          data-node-id="2521:43388"
          data-name="Sidebar navigation item"
        >
          <div className="admin-element-b2a182ecf" data-node-id="2521:43389" data-name="Verified">
            <img alt="" className="admin-element-8faf267d3" src={imgVerified} />
          </div>
          <Link
            className="admin-element-47b0da21e"
            data-node-id="2521:43390"
            href="/admin/verification"
          >
            Verification
          </Link>
        </div>
      </div>
      <div
        className="admin-element-10552d736"
        data-node-id="2521:43391"
        data-name="Sidebar spacer"
      />
      <div
        className="admin-element-410de4600"
        data-node-id="2521:43392"
        data-name="Settlement window"
      >
        <div
          className="admin-element-837d69a46"
          data-node-id="2521:43393"
          data-name="Settlement heading"
        >
          <p className="admin-element-336c377aa" data-node-id="2521:43394">
            Settlement Window
          </p>
          <p className="admin-element-a5c7b2ab0" data-node-id="2521:43395">
            T+1 Live
          </p>
        </div>
        <div
          className="admin-element-05d0cbbe9"
          data-node-id="2521:43396"
          data-name="Settlement progress"
        >
          <div
            className="admin-element-301479c45"
            data-node-id="2521:43397"
            data-name="Elapsed window"
          />
        </div>
        <p className="admin-element-16837c870" data-node-id="2521:43398">
          Daily cut-off: 16:30 WAT
        </p>
      </div>
    </div>
  );
}
