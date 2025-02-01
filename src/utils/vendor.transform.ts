export function transformVendorResponse(vendor: Record<string, any>) {
    return {
      _id: vendor._id.toString(),
      businessName: vendor.businessName,
      description: vendor.description,
      vendorTypes: vendor.vendorTypes || [],
      website: vendor.website,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
      postalCode: vendor.postalCode,
      location: {
        type: 'Point' as const,
        coordinates: [vendor.longitude, vendor.latitude] as [number, number],
      },
      logoUrl: vendor.logoUrl,
      vendorStatus: vendor.vendorStatus,
      actionNeeded: vendor.actionNeeded,
      adminNotes: vendor.adminNotes,
      stripeConnectId: vendor.stripeConnectId,
      stripeAccountStatus: vendor.stripeAccountStatus,
      accountBalance: vendor.accountBalance,
      pendingBalance: vendor.pendingBalance,
      internalAccountBalance: vendor.internalAccountBalance,
      vendorApplicationFee: vendor.vendorApplicationFee || 0.13,
      vendorPayments: vendor.vendorPayments || [],
      vendorPayouts: vendor.vendorPayouts || [],
      createdAt: vendor.createdAt?.toISOString(),
      updatedAt: vendor.updatedAt?.toISOString()
    };
  }