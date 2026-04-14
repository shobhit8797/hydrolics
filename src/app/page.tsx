import { getAllPOs, getUniqueSuppliers, getUniqueCustomers } from "@/lib/data";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  const allPOs = getAllPOs();
  const uniqueSuppliers = getUniqueSuppliers();
  const uniqueCustomers = getUniqueCustomers();

  return (
    <Dashboard
      allPOs={allPOs}
      uniqueSuppliers={uniqueSuppliers}
      uniqueCustomers={uniqueCustomers}
    />
  );
}
